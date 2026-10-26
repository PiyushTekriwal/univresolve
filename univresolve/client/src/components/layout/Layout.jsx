import { Navbar } from './Navbar';
import { Footer } from './Footer';

const Layout = ({ children }) => {
    return (
        <div className="min-h-screen flex flex-col bg-slate-50">
            <Navbar />
            
            <main className="flex-grow pt-16 px-2 sm:px-4">
                {children}
            </main>

            <Footer />
        </div>
    );
};

export { Layout };