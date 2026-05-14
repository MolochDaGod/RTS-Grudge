import "three";

declare module "three" {
  interface BufferGeometry {
    boundsTree?: import("three-mesh-bvh").MeshBVH;
    computeBoundsTree(options?: any): void;
    disposeBoundsTree(): void;
  }
}
