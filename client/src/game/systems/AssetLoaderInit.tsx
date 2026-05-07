import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { attachRenderer } from "./AssetLoader";

export function AssetLoaderInit() {
  const { gl } = useThree();

  useEffect(() => {
    attachRenderer(gl);
  }, [gl]);

  return null;
}
