import { vec3 } from 'gl-matrix';

export function computeSurfaceNormals(
    positions: Float32Array,
    triangles: Uint32Array
): Float32Array {
    const normals = new Float32Array(positions.length);
    normals.fill(0);

    for (let i = 0; i < triangles.length; i += 3) {
        const i0 = triangles[i + 0] * 3;
        const i1 = triangles[i + 1] * 3;
        const i2 = triangles[i + 2] * 3;

        const p0 = positions.subarray(i0);
        const p1 = positions.subarray(i1);
        const p2 = positions.subarray(i2);

        const v0 = vec3.subtract(vec3.create(), p1, p0);
        const v1 = vec3.subtract(vec3.create(), p2, p0);

        vec3.normalize(v0, v0);
        vec3.normalize(v1, v1);
        const norm = vec3.cross(vec3.create(), v0, v1);

        const n0 = normals.subarray(i0);
        const n1 = normals.subarray(i1);
        const n2 = normals.subarray(i2);

        // Accumulate the normals.
        vec3.add(n0, n0, norm);
        vec3.add(n1, n1, norm);
        vec3.add(n2, n2, norm);
    }

    for (let i = 0; i < normals.length; i += 3) {
        const n = normals.subarray(i);
        vec3.normalize(n, n);
    }

    return normals;
}

type ProjectedPlane = 'xy' | 'xz' | 'yz';

const projectedPlane2Ids: { [key in ProjectedPlane]: [number, number] } = {
    xy: [0, 1],
    xz: [0, 2],
    yz: [1, 2],
};

export function computeProjectedPlaneUVs(
    positions: [number, number, number][],
    projectedPlane: ProjectedPlane = 'xy'
): [number, number][] {
    const idxs = projectedPlane2Ids[projectedPlane];
    const uvs: [number, number][] = positions.map(() => {
        // Initialize to zero.
        return [0, 0];
    });
    const extentMin = [Infinity, Infinity];
    const extentMax = [-Infinity, -Infinity];
    positions.forEach((pos, i) => {
        // Simply project to the selected plane
        uvs[i][0] = pos[idxs[0]];
        uvs[i][1] = pos[idxs[1]];

        extentMin[0] = Math.min(pos[idxs[0]], extentMin[0]);
        extentMin[1] = Math.min(pos[idxs[1]], extentMin[1]);
        extentMax[0] = Math.max(pos[idxs[0]], extentMax[0]);
        extentMax[1] = Math.max(pos[idxs[1]], extentMax[1]);
    });
    uvs.forEach((uv) => {
        uv[0] = (uv[0] - extentMin[0]) / (extentMax[0] - extentMin[0]);
        uv[1] = (uv[1] - extentMin[1]) / (extentMax[1] - extentMin[1]);
    });
    return uvs;
}




// export class SphereMesh {

//     constructor(device: GPUDevice, radius: number = 1, detail: number = 3) {
//         // The vertices and indices arrays will be stored in these variables
//         let vertices: number[] = [];
//         let indices: number[] = [];

//         // The current index that we are up to in the vertices array
//         let currentIndex = 0;

//         // Iterate over each face in the original sphere geometry
//         for (let i = 0; i < detail; i++) {
//             for (let j = 0; j < detail; j++) {
//                 // Calculate the x, y, and z coordinates of the vertex
//                 const x = radius * Math.sin(Math.PI * i / detail) * Math.cos(2 * Math.PI * j / detail);
//                 const y = radius * Math.cos(Math.PI * i / detail);
//                 const z = radius * Math.sin(Math.PI * i / detail) * Math.sin(2 * Math.PI * j / detail);

//                 // Add the vertex to the vertices array
//                 vertices.push(x, y, z);

//                 // If this is not the first row or column,
//                 // we can create two triangles using this vertex
//                 // and the ones above and to the left
//                 if (i > 0 && j > 0) {
//                     // Calculate the indices of the vertices for the two triangles
//                     const a = currentIndex;
//                     const b = currentIndex - 1;
//                     const c = currentIndex - detail - 1;
//                     const d = currentIndex - detail;

//                     // Add the indices to the indices array
//                     indices.push(a, c, b, a, d, c);
//                 }

//                 // Increment the current index
//                 currentIndex++;
//             }
//         }

//         // Convert the vertices and indices arrays to Float32Arrays
//         const positionArray = new Float32Array(vertices);
//         const indexArray = new Int32Array(indices);
//     }
// }

export class Mesh {
    readonly positionBuffer: GPUBuffer;
    readonly colorBuffer: GPUBuffer;

    readonly positionLayout: GPUVertexBufferLayout
    readonly colorLayout: GPUVertexBufferLayout

    readonly indexBuffer: GPUBuffer
    readonly indexCount: number;
    readonly indexFormat: GPUIndexFormat;


    constructor(device: GPUDevice, positions: Float32Array, colors: Float32Array, indices: Uint32Array | Uint16Array) {

        this.indexFormat = indices.BYTES_PER_ELEMENT === 2 ? "uint16" : "uint32";
        this.indexCount = indices.length;

        const positionDescriptor: GPUBufferDescriptor = {
            size: (positions.byteLength + 3) & ~3,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true // similar to HOST_VISIBLE, allows buffer to be written by the CPU
        };

        const colorDescriptor: GPUBufferDescriptor = {
            size: (colors.byteLength + 3) & ~3,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true // similar to HOST_VISIBLE, allows buffer to be written by the CPU
        };

        const indexDescriptor: GPUBufferDescriptor = {
            size: (indices.byteLength + 3) & ~3,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true // similar to HOST_VISIBLE, allows buffer to be written by the CPU
        };

        this.positionBuffer = device.createBuffer(positionDescriptor);
        this.colorBuffer = device.createBuffer(colorDescriptor);
        this.indexBuffer = device.createBuffer(indexDescriptor);

        //Buffer has been created, now load in the vertices
        new Float32Array(this.positionBuffer.getMappedRange()).set(positions);
        this.positionBuffer.unmap();

        new Float32Array(this.colorBuffer.getMappedRange()).set(colors);
        this.colorBuffer.unmap();

        const mappedIndices = this.indexBuffer.getMappedRange();

        if (indices.BYTES_PER_ELEMENT === 2) {
            new Uint16Array(mappedIndices).set(indices);
        } else {
            new Uint32Array(mappedIndices).set(indices);
        }
        this.indexBuffer.unmap();

        const positionFormat: GPUVertexFormat = "float32x3";
        const colorFormat: GPUVertexFormat = "float32x3";

        //now define the buffer layout
        this.positionLayout = {
            arrayStride: 12,
            attributes: [
                {
                    shaderLocation: 0,
                    format: positionFormat,
                    offset: 0
                }
            ]
        }

        this.colorLayout = {
            arrayStride: 12,
            attributes: [
                {
                    shaderLocation: 1,
                    format: colorFormat,
                    offset: 0
                }
            ]
        }
    }
}

export class TriangleMesh extends Mesh {

    constructor(device: GPUDevice) {

        const positions = new Float32Array(
            [
                0.0, 0.0, 0.5,
                0.0, -0.5, -0.5,
                0.0, 0.5, -0.5,
            ]
        );

        const colors = new Float32Array(
            [
                1.0, 0.0, 0.0,
                0.0, 1.0, 0.0,
                0.0, 0.0, 1.0
            ]
        );

        const indices = new Uint16Array([0, 1, 2]);

        super(device, positions, colors, indices);
    }
}

export class IsoSphereMesh extends Mesh {

    // readonly buffer: GPUBuffer
    // readonly bufferLayout: GPUVertexBufferLayout

    constructor(device: GPUDevice, order = 4, uvMap = false) {
        if (order > 10)
            throw new Error(`Max order is 10, but given ${order}.`);

        // set up an icosahedron (12 vertices / 20 triangles)
        const f = (1 + Math.sqrt(5)) / 2;
        const T = Math.pow(4, order);

        const numVertices = 10 * T + 2;
        const numDuplicates = !uvMap ? 0 : order === 0 ? 3 : Math.pow(2, order) * 3 + 9;

        const positions = new Float32Array((numVertices + numDuplicates) * 3);
        positions.set(Float32Array.of(
            -1, f, 0, 1, f, 0, -1, -f, 0, 1, -f, 0,
            0, -1, f, 0, 1, f, 0, -1, -f, 0, 1, -f,
            f, 0, -1, f, 0, 1, -f, 0, -1, -f, 0, 1
        ));

        let indices = Uint32Array.of(
            0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11,
            11, 10, 2, 5, 11, 4, 1, 5, 9, 7, 1, 8, 10, 7, 6,
            3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9,
            9, 8, 1, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7
        );

        let v = 12;

        // midpoint vertices cache to avoid duplicating shared vertices
        const midCache = order ? new Map<number, number>() : null;

        function addMidPoint(a: number, b: number) {
            const key = Math.floor(((a + b) * (a + b + 1) / 2) + Math.min(a, b)); // Cantor's pairing function
            const i = midCache!.get(key);
            if (i !== undefined) {
                midCache!.delete(key); // midpoint is only reused once, so we delete it for performance
                return i;
            }
            midCache!.set(key, v);
            positions[3 * v + 0] = (positions[3 * a + 0] + positions[3 * b + 0]) * 0.5;
            positions[3 * v + 1] = (positions[3 * a + 1] + positions[3 * b + 1]) * 0.5;
            positions[3 * v + 2] = (positions[3 * a + 2] + positions[3 * b + 2]) * 0.5;
            return v++;
        }

        let trianglesPrev = indices;

        for (let i = 0; i < order; i++) { // repeatedly subdivide each triangle into 4 triangles
            const prevLen = trianglesPrev.length;
            indices = new Uint32Array(prevLen * 4);

            for (let k = 0; k < prevLen; k += 3) {
                const v1 = trianglesPrev[k + 0];
                const v2 = trianglesPrev[k + 1];
                const v3 = trianglesPrev[k + 2];
                const a = addMidPoint(v1, v2);
                const b = addMidPoint(v2, v3);
                const c = addMidPoint(v3, v1);
                let t = k * 4;
                indices[t++] = v1; indices[t++] = a; indices[t++] = c;
                indices[t++] = v2; indices[t++] = b; indices[t++] = a;
                indices[t++] = v3; indices[t++] = c; indices[t++] = b;
                indices[t++] = a; indices[t++] = b; indices[t++] = c;
            }
            trianglesPrev = indices;
        }

        // normalize vertices
        for (let i = 0; i < numVertices * 3; i += 3) {
            const v1 = positions[i + 0];
            const v2 = positions[i + 1];
            const v3 = positions[i + 2];
            const m = 1 / Math.sqrt(v1 * v1 + v2 * v2 + v3 * v3);
            positions[i + 0] *= m;
            positions[i + 1] *= m;
            positions[i + 2] *= m;
        }

        const normals = computeSurfaceNormals(positions, indices);

        super(device, positions, normals, indices);

        // if (!uvMap) return { vertices, triangles };

        // // uv mapping
        // const uv = new Float32Array((numVertices + numDuplicates) * 2);
        // for (let i = 0; i < numVertices; i++) {
        //     uv[2 * i + 0] = Math.atan2(vertices[3 * i + 2], vertices[3 * i]) / (2 * Math.PI) + 0.5;
        //     uv[2 * i + 1] = Math.asin(vertices[3 * i + 1]) / Math.PI + 0.5;
        // }

        // const duplicates = new Map();

        // function addDuplicate(i: number, uvx: number, uvy: number, cached: boolean) {
        //     if (cached) {
        //         const dupe = duplicates.get(i);
        //         if (dupe !== undefined) return dupe;
        //     }
        //     vertices[3 * v + 0] = vertices[3 * i + 0];
        //     vertices[3 * v + 1] = vertices[3 * i + 1];
        //     vertices[3 * v + 2] = vertices[3 * i + 2];
        //     uv[2 * v + 0] = uvx;
        //     uv[2 * v + 1] = uvy;
        //     if (cached) duplicates.set(i, v);
        //     return v++;
        // }

        // for (let i = 0; i < triangles.length; i += 3) {
        //     const a = triangles[i + 0];
        //     const b = triangles[i + 1];
        //     const c = triangles[i + 2];
        //     let ax = uv[2 * a];
        //     let bx = uv[2 * b];
        //     let cx = uv[2 * c];
        //     const ay = uv[2 * a + 1];
        //     const by = uv[2 * b + 1];
        //     const cy = uv[2 * c + 1];

        //     // uv fixing code; don't ask me how I got here
        //     if (bx - ax >= 0.5 && ay !== 1) bx -= 1;
        //     if (cx - bx > 0.5) cx -= 1;
        //     if ((ax > 0.5 && ax - cx > 0.5) || (ax === 1 && cy === 0)) ax -= 1;
        //     if (bx > 0.5 && bx - ax > 0.5) bx -= 1;

        //     if (ay === 0 || ay === 1) {
        //         ax = (bx + cx) / 2;
        //         if (ay === bx) uv[2 * a] = ax;
        //         else triangles[i + 0] = addDuplicate(a, ax, ay, false);

        //     } else if (by === 0 || by === 1) {
        //         bx = (ax + cx) / 2;
        //         if (by === ax) uv[2 * b] = bx;
        //         else triangles[i + 1] = addDuplicate(b, bx, by, false);

        //     } else if (cy === 0 || cy === 1) {
        //         cx = (ax + bx) / 2;
        //         if (cy === ax) uv[2 * c] = cx;
        //         else triangles[i + 2] = addDuplicate(c, cx, cy, false);
        //     }
        //     if (ax !== uv[2 * a] && ay !== 0 && ay !== 1) triangles[i + 0] = addDuplicate(a, ax, ay, true);
        //     if (bx !== uv[2 * b] && by !== 0 && by !== 1) triangles[i + 1] = addDuplicate(b, bx, by, true);
        //     if (cx !== uv[2 * c] && cy !== 0 && cy !== 1) triangles[i + 2] = addDuplicate(c, cx, cy, true);
        // }
    }
}