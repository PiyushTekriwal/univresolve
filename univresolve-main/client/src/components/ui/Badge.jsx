import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const Badge = ({ children, variant = "default", className }) => {
    const variants = {
        default: "bg-slate-100 text-slate-800",
        primary: "bg-blue-100 text-blue-800",
        success: "bg-green-100 text-green-800",
        warning: "bg-amber-100 text-amber-800",
        danger: "bg-red-100 text-red-800",
        critical: "bg-red-600 text-white font-bold",
        purple: "bg-purple-100 text-purple-800",
        outline: "border border-slate-200 text-slate-800"
    };

    return (
        <span
            className={twMerge(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                variants[variant],
                className
            )}
        >
            {children}
        </span>
    );
};

export { Badge };
