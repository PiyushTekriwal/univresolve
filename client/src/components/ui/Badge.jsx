import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const Badge = ({ children, variant = "default", className }) => {
    const variants = {
        default:   "bg-slate-100 text-slate-800",
        primary:   "bg-blue-100 text-blue-800",      // In Progress
        success:   "bg-green-100 text-green-800",
        warning:   "bg-yellow-100 text-yellow-800",
        danger:    "bg-red-100 text-red-800",
        secondary: "bg-purple-100 text-purple-800",
        outline:   "border border-slate-200 text-slate-800",
    };

    return (
        <span
            className={twMerge(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
                variants[variant] || variants.default,
                className
            )}
        >
            {children}
        </span>
    );
};

export { Badge };
