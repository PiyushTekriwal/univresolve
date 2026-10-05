import { forwardRef } from 'react';
import { twMerge } from 'tailwind-merge';

const Textarea = forwardRef(({ className, ...props }, ref) => {
    return (
        <textarea
            className={twMerge(
                "flex min-h-[80px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-all resize-y",
                className
            )}
            ref={ref}
            {...props}
        />
    );
});

Textarea.displayName = "Textarea";

export { Textarea };
