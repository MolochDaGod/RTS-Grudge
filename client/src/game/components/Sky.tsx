import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useGame } from "@/lib/stores/useGame";
import { Skybox, Clouds, Stars } from "../sky/SkyPrimitives";

/**
 * Full-featured sky system: skybox shader, sun directional light, lensflare,
 * animated clouds, twinkling stars, and a smooth day/night cycle driven by
 * useGame.dayTime (0-1).
 *
 * Cycle rate is controlled by useGame.updateDayTime: 20 real minutes of day,
 * 10 real minutes of night.
 */
export default function Sky() {
  const { dayTime } = useGame();
  const { camera, scene } = useThree();
  const elapsedRef = useRef(0);

  const { skybox, clouds, stars } = useMemo(() => {
    const sk = new Skybox();
    const cl = new Clouds();
    const st = new Stars();

    sk.onTimeOfDayChanged = (tod) => {
      if (tod === "Nighttime") {
        cl.setCloudColor(new THREE.Color(0.1, 0.1, 0.2));
        st.visible = true;
      } else if (tod === "Sunrise") {
        cl.setCloudColor(new THREE.Color(0.8, 0.4, 0.4));
        st.visible = false;
      } else if (tod === "Sunset") {
        cl.setCloudColor(new THREE.Color(0.8, 0.3, 0.3));
        st.visible = false;
      } else {
        cl.setCloudColor(new THREE.Color(1, 1, 1));
        st.visible = false;
      }
    };

    return { skybox: sk, clouds: cl, stars: st };
  }, []);

  // The sun directional light needs to live in the scene root (not under the
  // skybox's huge scale). Add/remove it imperatively. useEffect (not useMemo)
  // so cleanup actually runs on unmount.
  useEffect(() => {
    scene.add(skybox.sun);
    scene.add(skybox.sun.target);
    return () => {
      scene.remove(skybox.sun);
      scene.remove(skybox.sun.target);
    };
  }, [scene, skybox]);

  // GPU resource disposal on unmount.
  useEffect(() => {
    return () => {
      skybox.dispose();
      clouds.dispose();
      stars.dispose();
    };
  }, [skybox, clouds, stars]);

  // Track player position for shadow-camera centering. The simplest reliable
  // anchor that's always available is the camera's target/look-at; we use the
  // camera position projected onto the ground plane.
  const playerPos = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    elapsedRef.current += delta;

    // dayTime [0,1] -> Date with hours [0,24)
    const totalMinutes = dayTime * 24 * 60;
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = Math.floor(totalMinutes % 60);
    const gameTime = new Date();
    gameTime.setHours(hours, minutes, 0, 0);

    // Anchor shadows on the camera's ground projection (cheap, robust).
    playerPos.current.set(camera.position.x, 0, camera.position.z);

    skybox.update(gameTime, elapsedRef.current, playerPos.current, camera);
    clouds.update(delta, camera.position);
    stars.update(elapsedRef.current);
  });

  return (
    <>
      <primitive object={skybox} />
      <primitive object={clouds} />
      <primitive object={stars} />
    </>
  );
}
