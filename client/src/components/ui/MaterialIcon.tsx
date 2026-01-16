interface MaterialIconProps {
  name: string;
  className?: string;
  filled?: boolean;
  size?: number;
}

export default function MaterialIcon({ name, className = '', filled = false, size }: MaterialIconProps) {
  const style = size ? { fontSize: `${size}px` } : undefined;

  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{
        ...style,
        fontVariationSettings: filled ? "'FILL' 1" : "'FILL' 0",
      }}
    >
      {name}
    </span>
  );
}
