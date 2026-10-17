import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";

/** Bouton (style shadcn/ui, adapté à la charte). Variante `link` : rend un <Link>. */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap",
  {
    variants: {
      variant: {
        primary: "bg-orange-600 text-white hover:bg-orange-700 shadow-sm",
        secondary: "bg-bordeaux-700 text-white hover:bg-bordeaux-800",
        outline: "border border-line bg-white text-ink hover:border-bordeaux-200 hover:bg-bordeaux-50",
        ghost: "text-ink hover:bg-mist",
        success: "bg-olive-700 text-white hover:bg-olive-800",
        danger: "bg-red-700 text-white hover:bg-red-800",
        light: "bg-white/10 text-white border border-white/40 hover:bg-white/20",
      },
      size: { sm: "h-8 px-3 text-sm", md: "h-10 px-4 text-sm", lg: "h-12 px-6 text-base" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type Variants = VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & Variants) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export function ButtonLink({ className, variant, size, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & Variants & { href: string }) {
  return <Link href={href} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
