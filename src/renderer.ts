import shaders from "./shaders.wgsl";

function failure(method: string): never {
    const msg = `WebGPU ${method} failed!`;
    console.error(msg);
    throw new Error(msg);
}

export class CanvasRenderer {
    
    public readonly canvas: HTMLCanvasElement;
    public readonly context: GPUCanvasContext;
    
    constructor(device: GPUDevice, width: number, height: number) {
        // TODO: window.devicePixelRatio
        this.canvas = document.createElement("canvas");
        this.canvas.width = width;
        this.canvas.height = height;
        
        this.context = this.canvas.getContext('webgpu') as GPUCanvasContext;

        const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
      
        this.context.configure({
          device,
          size: [width, height], // TODO: window.devicePixelRatio
          format: presentationFormat,
          alphaMode: 'opaque',
        });
    }
    
    public tick(time: number) {
        
    }
}

export async function createRenderers(root: HTMLElement, canvasCount: number, canvasWidth: number, canvasHeight: number) {
    const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: "high-performance",
    }) ?? failure("navigator.requestAdapter");
    
    console.log(`GPU adapter: ${JSON.stringify(await adapter.requestAdapterInfo(), null, "  ")}`);
    
    const device = await adapter.requestDevice() ?? failure("adapter.requestDevice");
 
    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

    const sampleCount = 4;

    const pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: device.createShaderModule({
          code: shaders,
        }),
        entryPoint: 'main_vertex_shader',
      },
      fragment: {
        module: device.createShaderModule({
          code: shaders,
        }),
        entryPoint: 'main_fragment_shader',
        targets: [
          {
            format: presentationFormat,
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',
      },
      multisample: {
        count: sampleCount,
      },
    });
   
    const renderers = Array(canvasCount).fill(0).map(_ => {
        const renderer = new CanvasRenderer(device, canvasWidth, canvasHeight);
        root.appendChild(renderer.canvas);
        return renderer;
    });
    
    requestAnimationFrame(t => renderers.forEach(r => r.tick(t)));
    
    return () => {
        device.destroy();
    };
}