/*

    WebGPU and DirectX use a left-handed camera coordinate system, 
    where the view direction points down the Z+ axis 
    and the near and far clip planes are mapped 
    to the [0,1] normalized device coordinate (NDC) range in the Z axis.

      +y
      ^    +z 
      |  /
      |/
      +---->+x
        
        4--------0
      / |      / |
     7--------3  |
     |  5---- | -1
     ↑ ⭧      | /
     6--->----2
     

*/
const unitCubePointCoords = [
    +1, +1, +1, // 0
    +1, -1, +1, // 1
    +1, -1, -1, // 2
    +1, +1, -1, // 3
    -1, +1, +1, // 4
    -1, -1, +1, // 5
    -1, -1, -1, // 6
    -1, +1, -1, // 7
];

const unitCubePointIndices = [
    0, 1, 2, // +x
    2, 3, 0, // +x
    
    5, 4, 7, // -x
    7, 6, 5, // -x
    3, 0, 4, // +y
    4, 7, 3, // +y
    5, 6, 2, // -y
    2, 1, 5, // -y
    0, 4, 5, // +z
    5, 1, 0, // +z
    2, 1, 5, // -z
    5, 6, 2, // -z
];

const unitCubeNormalCoords = [
    +1, 0, 0, // +x
    -1, 0, 0, // -x
    0, +1, 0, // +y
    0, -1, 0, // -y
    0, 0, +1, // +z
    0, 0, -1, // -z
];

const unitCubeNormalIndices = [
    
    +1, 0, 0, // +x
    -1, 0, 0, // -x
    0, +1, 0, // +y
    0, -1, 0, // -y
    0, 0, +1, // +z
    0, 0, -1, // -z
];

// export interface MeshGeometry {



// }

// export function createCubeGeometry(device: GPUDevice, size: number) {



//   // Create a vertex buffer from the cube data.
//     const verticesBuffer = device.createBuffer({
//         size: cubeVertexArray.byteLength,
//         usage: GPUBufferUsage.VERTEX,
//         mappedAtCreation: true,
//     });
//     new Float32Array(verticesBuffer.getMappedRange()).set(cubeVertexArray);
//     verticesBuffer.unmap();

// }

export class TriangleMesh {

    buffer: GPUBuffer
    bufferLayout: GPUVertexBufferLayout

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