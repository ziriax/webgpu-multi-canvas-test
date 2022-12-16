import { mat4 } from "gl-matrix";
import { TriangleMesh } from "./geometry";
import shaders from "./shaders.wgsl";

function failure(method: string): never {
    const msg = `WebGPU ${method} failed!`;
    console.error(msg);
    throw new Error(msg);
}

export async function createRenderers(
    containerElem: HTMLElement, consoleElem: HTMLElement,
    canvasCount: number, canvasWidth: number, canvasHeight: number) {
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

    // const sampleCount = 4;

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

    const triangleMesh = new TriangleMesh(device);

    const pipeline = device.createRenderPipeline({
        vertex: {
            module: device.createShaderModule({
                code: shaders
            }),
            entryPoint: "vs_main",
            buffers: [triangleMesh.bufferLayout,]
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
            topology: "triangle-list"
        },

        // multisample: {
        //     count: sampleCount,
        // },

        layout: pipelineLayout
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

    const renderers = Array(canvasCount).fill(0).map(_ => {
        // TODO: window.devicePixelRatio
        const canvas = document.createElement("canvas");
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        containerElem.appendChild(canvas);

        const context = canvas.getContext('webgpu') as GPUCanvasContext;

        context.configure({
            device,
            format: presentationFormat,
            alphaMode: 'opaque',
        });

        // const renderTexture = device.createTexture({
        //     size: [canvas.width, canvas.height],
        //     // sampleCount,
        //     format: presentationFormat,
        //     usage: GPUTextureUsage.RENDER_ATTACHMENT,
        // });

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

        function tick(commandEncoder: GPUCommandEncoder, time: number) {
            mat4.identity(mvp);
            mat4.rotate(mvp, model, time / 1000, [0, 0, 1]);
            mat4.multiply(mvp, view, mvp);
            mat4.multiply(mvp, projection, mvp);

            device.queue.writeBuffer(uniformBuffer, 0, mvp as Float32Array);

            const canvasView: GPUTextureView = context.getCurrentTexture().createView();

            const renderPassOpts: GPURenderPassDescriptor = {
                colorAttachments: [{
                    view: canvasView,
                    clearValue: { r: 0.5, g: 0.0, b: 0.25, a: 1.0 },
                    loadOp: "clear" as const,
                    storeOp: "store" as const,
                }]
            };

            //renderpass: holds draw commands, allocated from command encoder
            const renderpass: GPURenderPassEncoder = commandEncoder.beginRenderPass(renderPassOpts);

            renderpass.setPipeline(pipeline);
            renderpass.setVertexBuffer(0, triangleMesh.buffer);
            renderpass.setBindGroup(0, bindGroup);
            renderpass.draw(3, 1, 0, 0);
            renderpass.end();
        }

        function dispose() {
            canvas.remove();
        }

        return {
            dispose,
            tick
        }
    });

    let lastTime = 0;
    let fps = 0;

    function tick(time: number) {
        const smooth = 0.1;
        fps = fps * smooth + (1000 / (time - lastTime)) * (1 - smooth);
        lastTime = time;

        consoleElem.innerText = `${fps.toFixed(2)}FPS`;

        const commandEncoder: GPUCommandEncoder = device.createCommandEncoder();
        renderers.forEach(r => r.tick(commandEncoder, time));
        device.queue.submit([commandEncoder.finish()]);
        requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);

    return () => {
        renderers.forEach(r => r.dispose());
        device.destroy();
    };
}