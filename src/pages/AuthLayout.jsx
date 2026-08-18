import { Children, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sparkles as ThreeSparkles } from "@react-three/drei";
import BrandLogo from "../components/BrandLogo";
import { Shield, Sparkles, Target, Phone, Workflow } from "../components/icons";

const SIGNALS = [
  { icon: Target, label: "Discover", text: "Find the right market" },
  { icon: Phone, label: "Converse", text: "AI Voice with context" },
  { icon: Workflow, label: "Advance", text: "Keep the next step connected" },
];

export default function AuthLayout({ eyebrow, title, text, children, footer }) {
  const reduceMotion = useReducedMotion();
  const childArray = Children.toArray(children);
  const primaryContent = childArray[0] || null;

  return (
    <>
      <AuthLayoutV11Styles />
      <motion.main className="rf11-auth-page" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduceMotion ? 0 : .38 }}>
        <div className="rf11-auth-bg" aria-hidden="true"><i/><i/><i/></div>
        <motion.section className="rf11-auth-shell" initial={reduceMotion ? false : { opacity: 0, y: 18, scale: .985 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: reduceMotion ? 0 : .62, ease: [.2,.8,.2,1] }}>
          <aside className="rf11-auth-hero">
            <div className="rf11-auth-three" aria-hidden="true">
              {!reduceMotion ? <Canvas camera={{ position:[0,0,5.8], fov:48 }} dpr={[1,1.5]} gl={{ antialias:true, alpha:true }}><AuthScene /></Canvas> : null}
            </div>
            <div className="rf11-auth-hero-shade" aria-hidden="true"/>
            <div className="rf11-auth-hero-top">
              <Link className="rf11-auth-brand" to="/" aria-label="ReachFly home"><BrandLogo size={42}/><span><b>ReachFly</b><small>AI</small></span></Link>
              <span className="rf11-auth-secure-pill"><Shield size={13}/> Secure workspace</span>
            </div>
            <motion.div className="rf11-auth-copy" initial={reduceMotion ? false : { opacity:0, y:22 }} animate={{ opacity:1, y:0 }} transition={{ delay:.12, duration:.6 }}>
              <span className="rf11-auth-eyebrow"><Sparkles size={13}/>{eyebrow}</span>
              <h1>{title}</h1>
              <p>{text}</p>
            </motion.div>
            <div className="rf11-auth-signals">
              {SIGNALS.map(({icon:Icon,label,text:signalText},index)=><motion.article key={label} initial={reduceMotion ? false : { opacity:0, y:18 }} animate={{ opacity:1,y:0 }} transition={{ delay:.22+index*.07 }}><span><Icon size={15}/></span><div><strong>{label}</strong><small>{signalText}</small></div></motion.article>)}
            </div>
            <div className="rf11-auth-flow" aria-hidden="true"><span>Market</span><i/><span>Context</span><i/><span>Voice</span><i/><span>Meeting</span></div>
          </aside>
          <section className="rf11-auth-panel">
            <motion.div className="rf11-auth-card" initial={reduceMotion ? false : { opacity:0, x:24 }} animate={{ opacity:1, x:0 }} transition={{ delay:.12, duration:.55, ease:[.2,.8,.2,1] }}>{primaryContent}</motion.div>
            {footer ? <div className="rf11-auth-footer">{footer}</div> : null}
          </section>
        </motion.section>
      </motion.main>
    </>
  );
}

function AuthScene(){
  const group=useRef(null);
  useFrame(({clock,pointer})=>{if(!group.current)return;group.current.rotation.y=clock.elapsedTime*.08+pointer.x*.16;group.current.rotation.x=pointer.y*.08;group.current.position.y=Math.sin(clock.elapsedTime*.55)*.08;});
  return <group ref={group} position={[1.15,.25,0]}>
    <ambientLight intensity={1.2}/><pointLight position={[2,2,3]} intensity={18} color="#7367ff"/><pointLight position={[-2,-1,2]} intensity={10} color="#44d7ff"/>
    <Float speed={1.4} rotationIntensity={.5} floatIntensity={.65}><mesh><icosahedronGeometry args={[1.05,2]}/><meshPhysicalMaterial color="#5d55ff" metalness={.45} roughness={.18} transparent opacity={.36} transmission={.28} thickness={1.2}/></mesh></Float>
    <mesh rotation={[1.15,.25,.4]}><torusGeometry args={[1.62,.018,16,160]}/><meshBasicMaterial color="#8e86ff" transparent opacity={.44}/></mesh>
    <mesh rotation={[.55,-.65,1.1]}><torusGeometry args={[2.0,.012,16,160]}/><meshBasicMaterial color="#53d5ff" transparent opacity={.24}/></mesh>
    <ThreeSparkles count={45} scale={[5,4,3]} size={1.4} speed={.28} color="#cbc8ff" opacity={.6}/>
  </group>;
}

function AuthLayoutV11Styles(){return <style>{`
  .rf11-auth-page{--a-bg:#050712;--a-panel:#0b0f1d;--a-card:rgba(14,18,33,.78);--a-line:rgba(166,176,255,.15);--a-text:#f7f8ff;--a-muted:#a9b0c7;--a-primary:#7463ff;min-height:100svh;display:grid;place-items:center;padding:28px;overflow:hidden;color:var(--a-text);background:#050712 url('/visuals/reachfly-auth-horizon.svg') center/cover fixed no-repeat;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;position:relative;isolation:isolate}
  .rf11-auth-page *,.rf11-auth-page *::before,.rf11-auth-page *::after{box-sizing:border-box}
  .rf11-auth-bg{position:fixed;inset:0;z-index:-2;pointer-events:none;overflow:hidden}.rf11-auth-bg::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(3,5,13,.20),rgba(3,5,13,.55) 52%,rgba(3,5,13,.28))}.rf11-auth-bg i{position:absolute;border-radius:50%;filter:blur(80px);opacity:.35;animation:rf11AuthDrift 12s ease-in-out infinite alternate}.rf11-auth-bg i:nth-child(1){width:420px;height:420px;left:-8%;top:-12%;background:#5148ff}.rf11-auth-bg i:nth-child(2){width:380px;height:380px;right:-4%;bottom:-8%;background:#9d3eff;animation-delay:-4s}.rf11-auth-bg i:nth-child(3){width:280px;height:280px;right:23%;top:10%;background:#2fbcff;opacity:.16;animation-delay:-7s}@keyframes rf11AuthDrift{to{transform:translate3d(35px,28px,0) scale(1.08)}}
  .rf11-auth-shell{width:min(1260px,calc(100vw - 56px))!important;min-height:min(760px,calc(100svh - 56px))!important;max-height:860px;display:grid!important;grid-template-columns:minmax(0,.93fr) minmax(500px,1.07fr)!important;overflow:hidden!important;border:1px solid rgba(172,181,255,.15)!important;border-radius:28px!important;background:rgba(7,9,18,.73)!important;box-shadow:0 55px 150px rgba(0,0,0,.48),inset 0 1px 0 rgba(255,255,255,.07)!important;backdrop-filter:blur(24px) saturate(135%)!important;position:relative!important}
  .rf11-auth-hero{position:relative!important;min-height:100%!important;padding:34px 38px 30px!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;color:#fff!important;background:linear-gradient(145deg,rgba(12,16,31,.84),rgba(8,10,20,.68))!important;border-right:1px solid rgba(255,255,255,.07)!important}
  .rf11-auth-hero::before{content:"";position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:42px 42px;mask-image:linear-gradient(to bottom,#000,transparent 86%);opacity:.28}
  .rf11-auth-three{position:absolute;inset:12% -15% 5% 22%;z-index:0;opacity:.85;filter:saturate(1.1)}.rf11-auth-three canvas{width:100%!important;height:100%!important}.rf11-auth-hero-shade{position:absolute;inset:0;z-index:1;background:linear-gradient(90deg,rgba(6,8,17,.94) 0%,rgba(7,9,18,.76) 47%,rgba(7,9,18,.13) 80%),linear-gradient(0deg,rgba(7,9,18,.78),transparent 45%);pointer-events:none}
  .rf11-auth-hero-top,.rf11-auth-copy,.rf11-auth-signals,.rf11-auth-flow{position:relative;z-index:3}.rf11-auth-hero-top{display:flex;align-items:center;justify-content:space-between;gap:16px}.rf11-auth-brand{display:flex;align-items:center;gap:10px;color:#fff!important;text-decoration:none}.rf11-auth-brand>span{display:flex;align-items:baseline;gap:4px}.rf11-auth-brand b{font-size:19px;letter-spacing:-.03em}.rf11-auth-brand small{font-size:8px;color:#bcb8ff;font-weight:900;letter-spacing:.1em}.rf11-auth-secure-pill{display:flex;align-items:center;gap:7px;padding:8px 11px;border:1px solid rgba(255,255,255,.1);border-radius:999px;background:rgba(255,255,255,.045);font-size:11px;color:#cbd0e2;backdrop-filter:blur(12px)}
  .rf11-auth-copy{max-width:570px;margin-top:clamp(68px,12vh,125px)}.rf11-auth-eyebrow{display:inline-flex;align-items:center;gap:7px;padding:8px 11px;border-radius:999px;background:rgba(108,91,255,.12);border:1px solid rgba(132,121,255,.22);font-size:10px;font-weight:850;letter-spacing:.12em;text-transform:uppercase;color:#c7c3ff}.rf11-auth-copy h1{max-width:580px;margin:17px 0 0;font:650 clamp(46px,4vw,66px)/.98 Inter,system-ui,sans-serif;letter-spacing:-.058em;color:#fff;text-wrap:balance}.rf11-auth-copy p{max-width:500px;margin:18px 0 0;font-size:15px;line-height:1.65;color:#a8afc5}
  .rf11-auth-signals{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:auto;padding-top:34px}.rf11-auth-signals article{min-width:0;display:flex;gap:9px;padding:11px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(255,255,255,.045);backdrop-filter:blur(12px)}.rf11-auth-signals article>span{width:31px;height:31px;display:grid;place-items:center;flex:0 0 auto;border-radius:10px;color:#bdb9ff;background:rgba(112,96,255,.14)}.rf11-auth-signals strong{display:block;font-size:11px;color:#fff}.rf11-auth-signals small{display:block;margin-top:3px;font-size:9px;line-height:1.35;color:#8991aa}.rf11-auth-flow{display:flex;align-items:center;gap:8px;margin-top:18px;color:#737c98;font-size:9px;text-transform:uppercase;letter-spacing:.09em}.rf11-auth-flow i{height:1px;flex:1;background:linear-gradient(90deg,rgba(119,102,255,.55),rgba(83,213,255,.2))}
  .rf11-auth-panel{position:relative!important;min-height:100%!important;padding:42px clamp(34px,4vw,64px)!important;display:flex!important;flex-direction:column!important;justify-content:center!important;background:linear-gradient(150deg,rgba(13,17,32,.92),rgba(7,9,18,.90))!important;color:#eef0ff!important;overflow:auto!important}.rf11-auth-panel::before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 88% 4%,rgba(112,95,255,.14),transparent 30%),radial-gradient(circle at 3% 94%,rgba(66,194,255,.08),transparent 30%)}
  .rf11-auth-card{position:relative!important;z-index:2;width:100%!important;max-width:560px!important;margin:auto!important;padding:0!important;background:transparent!important;border:0!important;box-shadow:none!important;color:#eef0ff!important}.rf11-auth-footer{position:relative;z-index:2;width:100%;max-width:560px;margin:20px auto 0;text-align:center;font-size:12px;color:#858da5}.rf11-auth-footer a{color:#a9a4ff!important;font-weight:800;text-decoration:none}.rf11-auth-footer a:hover{color:#fff!important}
  .rf11-auth-card .rf11-auth-form{width:100%;color:#edf0ff}.rf11-auth-card .rf11-auth-card-head h2{color:#fff!important;font-size:clamp(34px,3vw,46px)!important;line-height:1.02!important;letter-spacing:-.05em!important}.rf11-auth-card .rf11-auth-card-head p{color:#9fa7bf!important;font-size:13px!important;line-height:1.6!important}.rf11-auth-card label,.rf11-auth-card .rf11-auth-field-label{color:#cbd0e1!important}.rf11-auth-card input,.rf11-auth-card select{color:#f7f8ff!important}.rf11-auth-card input::placeholder{color:#656d84!important}
  .rf11-auth-card .rf11-auth-input>div,.rf11-auth-card .rf11-auth-field>div{background:rgba(255,255,255,.045)!important;border:1px solid rgba(170,179,255,.14)!important;color:#8e96ae!important;border-radius:14px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.025)!important;transition:border-color .2s ease,box-shadow .2s ease,background .2s ease!important}.rf11-auth-card .rf11-auth-input>div:focus-within,.rf11-auth-card .rf11-auth-field>div:focus-within{border-color:rgba(125,111,255,.72)!important;background:rgba(255,255,255,.065)!important;box-shadow:0 0 0 4px rgba(112,95,255,.10),inset 0 1px 0 rgba(255,255,255,.03)!important}
  .rf11-auth-card .rf11-auth-submit{min-height:52px!important;border:0!important;border-radius:14px!important;color:#fff!important;background:linear-gradient(135deg,#6c5cff,#8a4dff 56%,#5b84ff)!important;box-shadow:0 14px 36px rgba(103,79,255,.26)!important;font-weight:800!important;transition:transform .2s ease,box-shadow .2s ease!important}.rf11-auth-card .rf11-auth-submit:hover:not(:disabled){transform:translateY(-2px)!important;box-shadow:0 18px 44px rgba(103,79,255,.34)!important}
  .rf11-auth-card .rf11-auth-divider{color:#727b93!important}.rf11-auth-card .rf11-auth-divider::before{background:rgba(255,255,255,.1)!important}.rf11-auth-card .rf11-auth-divider>span{background:#0a0d19!important;color:#7f879e!important}.rf11-auth-card .rf11-auth-login-options,.rf11-auth-card .rf11-auth-login-options a{color:#9ca4ba!important}.rf11-auth-card .rf11-auth-login-options a{color:#a9a4ff!important}
  .rf11-auth-card .rf11-auth-type-grid{gap:12px!important}.rf11-auth-card .rf11-auth-type-card{background:rgba(255,255,255,.04)!important;border:1px solid rgba(165,174,255,.14)!important;color:#eef0ff!important;border-radius:18px!important}.rf11-auth-card .rf11-auth-type-card:hover,.rf11-auth-card .rf11-auth-type-card.active{background:rgba(112,95,255,.10)!important;border-color:rgba(133,121,255,.56)!important;box-shadow:0 18px 48px rgba(0,0,0,.18)!important}.rf11-auth-card .rf11-auth-type-card b{color:#fff!important}.rf11-auth-card .rf11-auth-type-card small{color:#9ba3ba!important}
  @media(max-width:1020px){.rf11-auth-shell{grid-template-columns:1fr!important;max-width:720px!important;max-height:none!important}.rf11-auth-hero{min-height:270px!important;padding:26px 28px!important}.rf11-auth-copy{margin-top:48px!important}.rf11-auth-copy h1{font-size:40px!important}.rf11-auth-copy p{display:none}.rf11-auth-signals,.rf11-auth-flow{display:none}.rf11-auth-three{inset:-10% -15% -25% 42%}.rf11-auth-panel{padding:38px 30px!important}}
  @media(max-width:640px){.rf11-auth-page{padding:0!important;background-attachment:scroll!important}.rf11-auth-shell{width:100%!important;min-height:100svh!important;border:0!important;border-radius:0!important}.rf11-auth-hero{min-height:220px!important;padding:22px 20px!important}.rf11-auth-secure-pill{display:none}.rf11-auth-copy{margin-top:40px!important}.rf11-auth-copy h1{font-size:34px!important}.rf11-auth-three{opacity:.55}.rf11-auth-panel{padding:30px 20px 36px!important}.rf11-auth-card .rf11-auth-card-head h2{font-size:32px!important}}
  @media(prefers-reduced-motion:reduce){.rf11-auth-bg i{animation:none!important}.rf11-auth-page *{scroll-behavior:auto!important}}
`}</style>}
