export default function BrandLogo({ size = 42, className = "", alt = "ReachFly.Ai" }) {
  return (
    <span
      className={`rf-brand-logo ${className}`}
      style={{
        "--rf-brand-logo-size": `${size}px`,
      }}
    >
      <img src="/favicon.svg" alt={alt} />
    </span>
  );
}