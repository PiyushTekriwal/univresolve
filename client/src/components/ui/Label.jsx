import { forwardRef } from 'react';
import { twMerge } from 'tailwind-merge';

const Label = forwardRef(({ className, ...props }, ref) => {
    return (
        <label
            ref={ref}
            className={twMerge(
                "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-700 mb-2 block",
                className
            )}
            {...props}
        />
    );
});

Label.displayName = "Label";

export { Label };
