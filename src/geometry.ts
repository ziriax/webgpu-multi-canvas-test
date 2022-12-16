export class TriangleMesh {

    readonly buffer: GPUBuffer
    readonly bufferLayout: GPUVertexBufferLayout

    constructor(device: GPUDevice) {

        // x y z r g b
        const vertices: Float32Array = new Float32Array(
            [
                0.0,  0.0,  0.5, 1.0, 0.0, 0.0,
                0.0, -0.5, -0.5, 0.0, 1.0, 0.0,
                0.0,  0.5, -0.5, 0.0, 0.0, 1.0
            ]
        );

        const usage: GPUBufferUsageFlags = GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST;
        //VERTEX: the buffer can be used as a vertex buffer
        //COPY_DST: data can be copied to the buffer

        const descriptor: GPUBufferDescriptor = {
            size: vertices.byteLength,
            usage: usage,
            mappedAtCreation: true // similar to HOST_VISIBLE, allows buffer to be written by the CPU
        };

        this.buffer = device.createBuffer(descriptor);

        //Buffer has been created, now load in the vertices
        new Float32Array(this.buffer.getMappedRange()).set(vertices);
        this.buffer.unmap();
        
        const positionFormat: GPUVertexFormat = "float32x4";
        const colorFormat: GPUVertexFormat = "float32x3";
        
        //now define the buffer layout
        this.bufferLayout = {
            arrayStride: 24,
            attributes: [
                {
                    shaderLocation: 0,
                    format: positionFormat,
                    offset: 0
                },
                {
                    shaderLocation: 1,
                    format: colorFormat,
                    offset: 12
                }
            ]
        }

    }
}