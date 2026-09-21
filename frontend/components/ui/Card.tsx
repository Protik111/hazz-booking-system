import { cn } from "@/lib/cn";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  hoverable?: boolean;
}

export default function Card({
  children,
  className,
  hoverable,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-card border border-border bg-card p-6",
        hoverable &&
          "transition-all duration-200 hover:border-emerald/40 hover:shadow-[0_0_20px_rgba(4,120,87,0.06)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}