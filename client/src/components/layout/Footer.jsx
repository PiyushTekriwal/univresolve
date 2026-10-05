const Footer = () => {
    return (
        <footer className="bg-white border-t border-slate-200 mt-auto">
            <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col md:flex-row justify-between items-center">
                    <div className="mb-4 md:mb-0">
                        <span className="text-lg font-bold text-slate-800">UNIV<span className="text-primary-600">Resolve</span></span>
                        <p className="text-slate-500 text-sm mt-1">Empowering students, improving campus life.</p>
                    </div>
                    <div className="flex space-x-6">
                        <a href="#" className="text-slate-400 hover:text-slate-600 transition-colors">
                            Privacy Policy
                        </a>
                        <a href="#" className="text-slate-400 hover:text-slate-600 transition-colors">
                            Terms of Service
                        </a>
                        <a href="#" className="text-slate-400 hover:text-slate-600 transition-colors">
                            Support
                        </a>
                    </div>
                </div>
                <div className="mt-8 border-t border-slate-100 pt-8 text-center text-slate-400 text-sm">
                    &copy; {new Date().getFullYear()} UNIV University. All rights reserved.
                </div>
            </div>
        </footer>
    );
};

export { Footer };
