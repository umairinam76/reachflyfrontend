import { Children, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sparkles as ThreeSparkles } from "@react-three/drei";
import {
  Shield,
  Sparkles,
  Target,
  Phone,
  Workflow,
} from "../components/icons";
import "../styles.css";

const SIGNALS = [
  { icon: Target, label: "Discover", text: "Find the right market" },
  { icon: Phone, label: "Converse", text: "AI Voice with context" },
  { icon: Workflow, label: "Advance", text: "Keep the next step connected" },
];

export default function AuthLayout({
  eyebrow,
  title,
  text,
  children,
  footer,
}) {
  const reduceMotion = useReducedMotion();
  const childArray = Children.toArray(children);
  const primaryContent = childArray[0] || null;

  return (
    <motion.main
      className="rf15-auth-page"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.35 }}
    >
      <div className="rf15-auth-atmosphere" aria-hidden="true">
        <span className="rf15-auth-glow rf15-auth-glow-a" />
        <span className="rf15-auth-glow rf15-auth-glow-b" />
        <span className="rf15-auth-glow rf15-auth-glow-c" />
        <span className="rf15-auth-grid" />
      </div>

      <motion.section
        className="rf15-auth-shell"
        initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          duration: reduceMotion ? 0 : 0.58,
          ease: [0.2, 0.8, 0.2, 1],
        }}
      >
        <aside className="rf15-auth-hero">
          <div className="rf15-auth-three" aria-hidden="true">
            {!reduceMotion ? (
              <Canvas
                camera={{ position: [0, 0, 5.8], fov: 48 }}
                dpr={[1, 1.5]}
                gl={{ antialias: true, alpha: true }}
              >
                <AuthScene />
              </Canvas>
            ) : null}
          </div>

          <div className="rf15-auth-hero-shade" aria-hidden="true" />

          <div className="rf15-auth-hero-top">
            <Link className="rf15-auth-brand" to="/" aria-label="ReachFly home">
              <span className="rf15-auth-brand-mark" aria-hidden="true">
                <img src="/favicon.svg" alt="" draggable="false" />
              </span>
              <span className="rf15-auth-brand-copy">
                <strong>ReachFly</strong>
                <small>AI</small>
              </span>
            </Link>

            <span className="rf15-auth-secure-pill">
              <Shield size={13} />
              Secure workspace
            </span>
          </div>

          <motion.div
            className="rf15-auth-copy"
            initial={reduceMotion ? false : { opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: reduceMotion ? 0 : 0.55 }}
          >
            <span className="rf15-auth-eyebrow">
              <Sparkles size={13} />
              {eyebrow}
            </span>
            <h1>{title}</h1>
            <p>{text}</p>
          </motion.div>

          <div className="rf15-auth-signals">
            {SIGNALS.map(({ icon: Icon, label, text: signalText }, index) => (
              <motion.article
                key={label}
                initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 + index * 0.06 }}
              >
                <span>
                  <Icon size={15} />
                </span>
                <div>
                  <strong>{label}</strong>
                  <small>{signalText}</small>
                </div>
              </motion.article>
            ))}
          </div>

          <div className="rf15-auth-flow" aria-hidden="true">
            <span>Market</span><i />
            <span>Context</span><i />
            <span>Voice</span><i />
            <span>Meeting</span>
          </div>
        </aside>

        <section className="rf15-auth-panel">
          <motion.div
            className="rf15-auth-card"
            initial={reduceMotion ? false : { opacity: 0, x: 22 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              delay: 0.1,
              duration: reduceMotion ? 0 : 0.5,
              ease: [0.2, 0.8, 0.2, 1],
            }}
          >
            {primaryContent}
          </motion.div>

          {footer ? <div className="rf15-auth-footer">{footer}</div> : null}
        </section>
      </motion.section>
    </motion.main>
  );
}

function AuthScene() {
  const group = useRef(null);

  useFrame(({ clock, pointer }) => {
    if (!group.current) return;
    const t = clock.elapsedTime;
    group.current.rotation.y = t * 0.075 + pointer.x * 0.18;
    group.current.rotation.x = pointer.y * 0.08 + Math.sin(t * 0.34) * 0.03;
    group.current.position.y = Math.sin(t * 0.5) * 0.055;
  });

  const nodes = [
    [-1.55, 0.5, 0.2],
    [1.34, 0.72, -0.2],
    [0.62, -1.28, 0.18],
    [-0.9, -1.05, -0.35],
  ];

  return (
    <group ref={group} position={[1.05, 0.15, 0]}>
      <ambientLight intensity={0.9} />
      <pointLight position={[2.5, 2.6, 3.8]} intensity={18} color="#7567ff" />
      <pointLight position={[-2.8, -1.4, 2.4]} intensity={9} color="#55d7ff" />

      <Float speed={1.2} rotationIntensity={0.34} floatIntensity={0.45}>
        <mesh>
          <icosahedronGeometry args={[1.02, 3]} />
          <meshPhysicalMaterial
            color="#6258ff"
            metalness={0.52}
            roughness={0.14}
            transparent
            opacity={0.28}
            transmission={0.28}
            thickness={1.2}
          />
        </mesh>
        <mesh scale={1.075}>
          <icosahedronGeometry args={[1.02, 2]} />
          <meshBasicMaterial color="#aaa4ff" wireframe transparent opacity={0.14} />
        </mesh>
        <mesh scale={0.27}>
          <sphereGeometry args={[1, 36, 36]} />
          <meshBasicMaterial color="#8be8ff" transparent opacity={0.9} />
        </mesh>
      </Float>

      <mesh rotation={[1.15, 0.25, 0.4]}>
        <torusGeometry args={[1.62, 0.015, 16, 180]} />
        <meshBasicMaterial color="#9188ff" transparent opacity={0.4} />
      </mesh>
      <mesh rotation={[0.55, -0.65, 1.1]}>
        <torusGeometry args={[2.0, 0.01, 16, 180]} />
        <meshBasicMaterial color="#55d7ff" transparent opacity={0.25} />
      </mesh>
      <mesh rotation={[0.2, 0.9, 0.35]}>
        <torusGeometry args={[2.28, 0.007, 12, 180]} />
        <meshBasicMaterial color="#b665ff" transparent opacity={0.13} />
      </mesh>

      {nodes.map((position, index) => (
        <Float key={index} speed={1.05 + index * 0.12} floatIntensity={0.42}>
          <mesh position={position}>
            <sphereGeometry args={[0.06, 20, 20]} />
            <meshBasicMaterial color={index % 2 ? "#59d7ff" : "#9f8cff"} />
          </mesh>
        </Float>
      ))}

      <ThreeSparkles
        count={58}
        scale={[5.2, 4.2, 3.2]}
        size={1.15}
        speed={0.2}
        color="#d8d5ff"
        opacity={0.48}
      />
    </group>
  );
}
