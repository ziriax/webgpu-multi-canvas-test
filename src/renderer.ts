import { mat4 } from "gl-matrix";
import { IsoSphereMesh } from "./geometry";
import shaders from "./shaders.wgsl";

function failure(method: string): never {
    const msg = `WebGPU ${method} failed!`;
    console.error(msg);
    throw new Error(msg);
}

export async function createRenderers(
    containerElem: HTMLElement,
    canvasCount: number, canvasWidth: number, canvasHeight: number) {

    const cellsSideCount = 4;
    const cellsCount = cellsSideCount * cellsSideCount;
    const cellsWidth = cellsSideCount * canvasWidth;
    const cellsHeight = cellsSideCount * canvasHeight;

    const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: "high-performance",
        // powerPreference: "low-power"
    }) ?? failure("navigator.requestAdapter");

    if (adapter.requestAdapterInfo) {
        const info = await adapter.requestAdapterInfo();
        console.log(`GPU adapter: '${info.description}' from ${info.vendor}, device ${info.device}`);
    }

    const device = await adapter.requestDevice() ?? failure("adapter.requestDevice");

    const presentationFormat: GPUTextureFormat =
        typeof navigator.gpu.getPreferredCanvasFormat === "function"
            ? navigator.gpu.getPreferredCanvasFormat()
            : "bgra8unorm";

    const sampleCount = 4;

    function createResolvedCells() {
        const texture = device.createTexture({
            size: [cellsWidth, cellsHeight],
            format: presentationFormat,
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
        });

        const view: GPUTextureView = texture.createView();

        return { texture, view };
    }

    function createMsaaTargetCells() {
        const texture = device.createTexture({
            size: [cellsWidth, cellsHeight],
            sampleCount,
            format: presentationFormat,
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
        });

        const view: GPUTextureView = texture.createView();

        return { texture, view };
    }

    const targetCells = sampleCount > 1 ? createMsaaTargetCells() : null;
    const resolvedCells = createResolvedCells();

    const depthStencilState: GPUDepthStencilState = {
        format: "depth32float",
        depthWriteEnabled: true,
        depthCompare: "less-equal",
    };

    const size: GPUExtent3D = {
        width: cellsWidth,
        height: cellsHeight,
        depthOrArrayLayers: 1
    };

    const depthBufferDescriptor: GPUTextureDescriptor = {
        size: size,
        format: depthStencilState.format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        sampleCount
    }

    const depthStencilBuffer = device.createTexture(depthBufferDescriptor);

    const viewDescriptor: GPUTextureViewDescriptor = {
        format: depthStencilState.format,
        dimension: "2d",
        aspect: "depth-only"
    };

    const depthStencilView = depthStencilBuffer.createView(viewDescriptor);

    const depthStencilAttachment: GPURenderPassDepthStencilAttachment = {
        view: depthStencilView,
        depthClearValue: 1.0,
        depthLoadOp: "clear",
        depthStoreOp: "store",

        // stencilLoadOp: "clear",
        // stencilStoreOp: "discard"
    };

    // const cellContext = cellCanvas.getContext('webgpu') as GPUCanvasContext;

    // cellContext.configure({
    //     device,
    //     format: presentationFormat,
    //     alphaMode: 'opaque',
    // });

    const bindGroupLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.VERTEX,
                buffer: {}
            }
        ]
    });

    const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout]
    });

    const mesh = new IsoSphereMesh(device, 5);
    console.warn(mesh.indexCount);

    const pipeline = device.createRenderPipeline({
        vertex: {
            module: device.createShaderModule({
                code: shaders
            }),
            entryPoint: "vs_main",
            buffers: [mesh.positionLayout, mesh.colorLayout]
        },

        fragment: {
            module: device.createShaderModule({
                code: shaders
            }),
            entryPoint: "fs_main",
            targets: [{
                format: presentationFormat
            }]
        },

        primitive: {
            topology: "triangle-list",
            cullMode: "back"
        },

        multisample: {
            count: sampleCount,
        },

        layout: pipelineLayout,

        depthStencil: depthStencilState,
    });

    // make transforms
    const projection = mat4.create();
    // load perspective projection into the projection matrix,
    // Field of view = 45 degrees (pi/4)
    // near = 0.1, far = 10 
    mat4.perspective(projection, Math.PI / 4, canvasWidth / canvasHeight, 0.1, 10);

    const view = mat4.create();

    //load lookat matrix into the view matrix,
    //looking from [-2, 0, 2]
    //looking at [0, 0, 0]
    //up vector is [0, 0, 1]
    mat4.lookAt(view, [-2, 0, 2], [0, 0, 0], [0, 0, 1]);

    const renderers = Array(canvasCount).fill(0).map((_, index) => {
        // TODO: window.devicePixelRatio
        const canvas = document.createElement("canvas");
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        const context = canvas.getContext('webgpu') as GPUCanvasContext;

        context.configure({
            device,
            format: presentationFormat,
            alphaMode: 'opaque',
            usage: GPUTextureUsage.COPY_DST
        });

        // const context = canvas.getContext("2d");

        containerElem.appendChild(canvas);

        // const renderView = renderTexture.createView();

        const model = mat4.create();
        const mvp = mat4.create();

        const uniformBuffer = device.createBuffer({
            size: 64 * 1,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        const bindGroup = device.createBindGroup({
            layout: bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: uniformBuffer
                    }
                }
            ]
        });

        function tick(cellX: number, cellY: number, renderPass: GPURenderPassEncoder, time: number) {
            mat4.identity(mvp);
            mat4.rotate(mvp, model, time / 1000, [0, 0, 1]);
            mat4.multiply(mvp, view, mvp);
            mat4.multiply(mvp, projection, mvp);

            device.queue.writeBuffer(uniformBuffer, 0, mvp as Float32Array);

            renderPass.setScissorRect(cellX, cellY, canvasWidth, canvasHeight);
            renderPass.setViewport(cellX, cellY, canvasWidth, canvasHeight, 0, 1);
            renderPass.setIndexBuffer(mesh.indexBuffer, mesh.indexFormat);
            renderPass.setVertexBuffer(0, mesh.positionBuffer);
            renderPass.setVertexBuffer(1, mesh.colorBuffer);
            renderPass.setBindGroup(0, bindGroup);
            renderPass.drawIndexed(mesh.indexCount);
        }

        function dispose() {
            canvas.remove();
        }

        function display(cellX: number, cellY: number, cellsTexture: GPUTexture, commandEncoder: GPUCommandEncoder) {

            commandEncoder.copyTextureToTexture(
                {
                    texture: cellsTexture,
                    origin: [cellX, cellY],
                },
                {
                    texture: context.getCurrentTexture(),
                },
                { width: canvasWidth, height: canvasHeight }
            );

            // context?.drawImage(cellCanvas,
            //     cellX, cellY, canvasWidth, canvasHeight,
            //     0, 0, canvasWidth, canvasHeight);
        }

        return {
            dispose,
            display,
            tick
        }
    });

    let lastTime = 0;
    let fps = 70;

    // let activeLowerBound = 0;
    // let activeUpperBound = renderers.length;
    // let countLowerBound = 0;
    // let countUpperBound = 0;
    const bumpUpAfter = 5;
    const bumpDownAfter = 50;

    let bumpUpCount = 0;
    let bumpDownCount = 0;
    let activeCount = 50;

    async function tick(time: number) {
        const smooth = 0.9;
        fps = fps * smooth + (1000 / (time - lastTime)) * (1 - smooth);
        lastTime = time;

        if (fps >= 59.9) {
            if (++bumpUpCount >= bumpUpAfter) {
                activeCount = Math.min(renderers.length, activeCount + 1);
                bumpUpCount = 0;
            }
        } else {
            bumpUpCount = 0;
        }

        if (fps <= 59) {
            if (++bumpDownCount >= bumpDownAfter) {
                activeCount = Math.max(1, activeCount - 1);
                bumpDownCount = 0;
            }
        } else {
            bumpDownCount = 0;
        }
        // const activeCount = (activeLowerBound + activeUpperBound + 1) >> 1;

        // if (fps < 55 && ++countUpperBound >= checkAfter) {
        //     activeUpperBound = activeCount;
        //     countUpperBound = 0;
        // }

        // if (fps >= 60 && ++countLowerBound >= checkAfter) {
        //     activeLowerBound = activeCount + 1;
        //     countLowerBound = 0;
        // }

        // consoleElem.innerText = `${fps.toFixed(2)}FPS`;
        document.title = `${activeCount} ${fps.toFixed(0)}FPS`;

        const commandEncoder: GPUCommandEncoder = device.createCommandEncoder();

        function createRenderPassOpts(r: typeof resolvedCells, t: typeof targetCells) {

            const colorAttachment: GPURenderPassColorAttachment = t
                ? {
                    resolveTarget: r.view,
                    view: t.view,
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                    loadOp: "clear" as const,
                    storeOp: "store" as const,
                }
                : {
                    view: r.view,
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                    loadOp: "clear" as const,
                    storeOp: "store" as const,
                };

            const renderPassOpts: GPURenderPassDescriptor = {
                colorAttachments: [colorAttachment],
                depthStencilAttachment
            };

            return renderPassOpts;
        }

        const renderPassOpts = createRenderPassOpts(resolvedCells, targetCells);

        for (let renderersIndex = 0; renderersIndex < activeCount; renderersIndex += cellsCount) {
            //renderpass: holds draw commands, allocated from command encoder
            const renderPass: GPURenderPassEncoder = commandEncoder.beginRenderPass(renderPassOpts);
            renderPass.setPipeline(pipeline);

            const count = Math.min(activeCount - renderersIndex, cellsCount);

            for (let i = 0; i < count; ++i) {
                const cellX = (i % cellsSideCount) * canvasWidth;
                const cellY = Math.floor(i / cellsSideCount) * canvasHeight;
                renderers[renderersIndex + i].tick(cellX, cellY, renderPass, time);
            }

            renderPass.end();

            for (let i = 0; i < count; ++i) {
                const cellX = (i % cellsSideCount) * canvasWidth;
                const cellY = Math.floor(i / cellsSideCount) * canvasHeight;
                renderers[renderersIndex + i].display(cellX, cellY, resolvedCells.texture, commandEncoder);
            }
        }

        device.queue.submit([commandEncoder.finish()]);

        // await device.queue.onSubmittedWorkDone();

        requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);

    return () => {
        renderers.forEach(r => r.dispose());
        device.destroy();
    };
}