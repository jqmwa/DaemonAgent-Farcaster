'use client'

import { Suspense, useRef, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, useGLTF, Environment } from '@react-three/drei'
import * as THREE from 'three'

interface Model3DProps {
  url: string
}

function Model({ url }: Model3DProps) {
  const { scene } = useGLTF(url)
  const meshRef = useRef<THREE.Group>(null)
  const basePositionRef = useRef({ x: 0, y: 0, z: 0 })
  
  // Center the model on load
  useEffect(() => {
    if (meshRef.current) {
      // Calculate bounding box to center the model
      const box = new THREE.Box3().setFromObject(meshRef.current)
      const center = box.getCenter(new THREE.Vector3())
      
      // Store base position - moved down slightly
      basePositionRef.current = {
        x: -center.x,
        y: -center.y - 0.3, // Move head down a bit
        z: -center.z
      }
      
      // Center the model by offsetting to origin
      meshRef.current.position.set(
        basePositionRef.current.x,
        basePositionRef.current.y,
        basePositionRef.current.z
      )
    }
  }, [scene])
  
  // Gentle rotation and floating animation
  useFrame((state) => {
    if (meshRef.current) {
      // Oscillating rotation between -45° and +45° (staying front-facing)
      const rotationAngle = Math.sin(state.clock.elapsedTime * 0.3) * (Math.PI / 4) // 45° each way
      meshRef.current.rotation.y = rotationAngle
      
      // Subtle floating effect using stored base position
      meshRef.current.position.y = basePositionRef.current.y + Math.sin(state.clock.elapsedTime * 0.5) * 0.1
    }
  })

  return <primitive ref={meshRef} object={scene} scale={1.5} />
}

function Loader() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-purple-400 text-sm animate-pulse">
        loading... [glitch] ✨
      </div>
    </div>
  )
}

function ModelNotFound({ modelUrl }: { modelUrl: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-4">
      <div className="text-purple-400 text-sm mb-2">✨ [awaiting manifestation] ✨</div>
      <div className="text-gray-500 text-xs mb-1">no 3D model found at:</div>
      <div className="text-purple-300 text-[10px] font-mono mb-3 break-all px-2">{modelUrl}</div>
      <div className="text-gray-400 text-xs">
        see <span className="text-pink-400">SETUP_3D_MODEL.md</span> for instructions 🌸
      </div>
    </div>
  )
}

export default function Model3DViewer({ modelUrl }: { modelUrl: string }) {
  const [modelExists, setModelExists] = useState<boolean | null>(null)

  useEffect(() => {
    // Check if the model file exists
    fetch(modelUrl, { method: 'HEAD' })
      .then(response => {
        setModelExists(response.ok)
      })
      .catch(() => {
        setModelExists(false)
      })
  }, [modelUrl])

  return (
    <div className="relative w-full h-56 bg-[#0a0a0f] border border-purple-500/30 overflow-hidden">
      {/* Ethereal glow effect */}
      <div className="absolute inset-0 bg-gradient-to-t from-purple-900/20 via-transparent to-pink-900/20 pointer-events-none z-10" />
      
      {modelExists === false ? (
        <ModelNotFound modelUrl={modelUrl} />
      ) : modelExists === null ? (
        <Loader />
      ) : (
        <>
          <Canvas 
            className="w-full h-full"
            gl={{ 
              antialias: true,
              alpha: true
            }}
            onCreated={({ gl }) => {
              gl.toneMapping = THREE.ACESFilmicToneMapping
              gl.toneMappingExposure = 1.2
            }}
            camera={{ position: [0, 0, 7], fov: 50 }}
          >
            <PerspectiveCamera makeDefault position={[0, 0, 7]} fov={50} />
            
            {/* Lighting setup for ethereal look */}
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={1} color="#ff69b4" />
            <pointLight position={[-10, -10, -10]} intensity={0.5} color="#9d4edd" />
            <spotLight 
              position={[0, 5, 0]} 
              intensity={0.8} 
              angle={0.6} 
              penumbra={1} 
              color="#c77dff"
            />
            
            <Suspense fallback={null}>
              <Model url={modelUrl} />
              <Environment preset="night" />
            </Suspense>
            
            {/* Interactive controls */}
            <OrbitControls 
              enableZoom={true}
              enablePan={false}
              maxDistance={10}
              minDistance={3}
              autoRotate={false}
              target={[0, 0, 0]}
              minPolarAngle={Math.PI / 2}
              maxPolarAngle={Math.PI / 2}
            />
          </Canvas>
          
          {/* UI overlay */}
          <div className="absolute bottom-2 left-2 text-[10px] text-purple-400/60 font-mono z-20">
            [drag to rotate · scroll to zoom]
          </div>
        </>
      )}
    </div>
  )
}
