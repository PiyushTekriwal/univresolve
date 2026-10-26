import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Menu, X, ShieldCheck } from 'lucide-react';
import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();

    const [user, setUser] = useState(() => {
        try {
            const raw = localStorage.getItem('user');
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    });

    // 🔄 refresh user on route change
    useEffect(() => {
        try {
            const raw = localStorage.getItem('user');
            setUser(raw ? JSON.parse(raw) : null);
        } catch {
            setUser(null);
        }
    }, [location.pathname]);

    const handleLogout = () => {
        localStorage.removeItem('user');
        setUser(null);
        navigate('/');
    };

    const navLinks = [
        { name: 'Home', path: '/' },
        { name: 'Dashboard', path: '/dashboard' },
        { name: 'File Complaint', path: '/complaint' },
        { name: 'History', path: '/history' },
    ];

    // 🔥 FIX: case-insensitive role check
    const isAdmin = user?.role?.toLowerCase() === 'admin';

    const adminLinks = isAdmin
        ? [{ name: 'Admin Panel', path: '/admin' }]
        : [];

    const allNavLinks = [...navLinks, ...adminLinks];

    const isActive = (path) => location.pathname === path;

    return (
        <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">

                    {/* 🔥 Logo */}
                    <Link to="/" className="flex items-center space-x-2 group">
                        <div className="bg-primary-600 p-2 rounded-lg group-hover:bg-primary-700 transition">
                            <ShieldCheck className="h-6 w-6 text-white" />
                        </div>
                        <span className="font-bold text-xl text-slate-800">
                            UNIV<span className="text-primary-600">Resolve</span>
                        </span>
                    </Link>

                    {/* 💻 Desktop */}
                    <div className="hidden md:flex items-center space-x-8">

                        {allNavLinks.map((link) => (
                            <Link
                                key={link.path}
                                to={link.path}
                                className={`text-sm font-medium transition hover:text-primary-600 ${
                                    isActive(link.path)
                                        ? 'text-primary-600'
                                        : 'text-slate-600'
                                }`}
                            >
                                {link.name}
                            </Link>
                        ))}

                        {user ? (
                            <div className="flex items-center space-x-4">

                                {/* 👤 user name */}
                                <span className="text-sm text-slate-600">
                                    Hi,&nbsp;
                                    <span className="font-semibold">
                                        {user.name || user.email}
                                    </span>
                                </span>

                                {/* 🔥 role badge */}
                                {isAdmin && (
                                    <span className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded">
                                        ADMIN
                                    </span>
                                )}

                                <Button size="sm" variant="outline" onClick={handleLogout}>
                                    Logout
                                </Button>
                            </div>
                        ) : (
                            <Link to="/login">
                                <Button size="sm">Login</Button>
                            </Link>
                        )}
                    </div>

                    {/* 📱 Mobile toggle */}
                    <div className="md:hidden flex items-center">
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            className="text-slate-600"
                        >
                            {isOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>

                </div>
            </div>

            {/* 📱 Mobile Menu */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="md:hidden bg-white border-b"
                    >
                        <div className="px-4 pt-2 pb-6 space-y-2">

                            {allNavLinks.map((link) => (
                                <Link
                                    key={link.path}
                                    to={link.path}
                                    onClick={() => setIsOpen(false)}
                                    className={`block px-3 py-2 rounded ${
                                        isActive(link.path)
                                            ? 'bg-primary-50 text-primary-600'
                                            : 'text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    {link.name}
                                </Link>
                            ))}

                            <div className="pt-4">

                                {user ? (
                                    <div className="space-y-3">

                                        <p className="text-sm text-slate-600">
                                            Signed in as{' '}
                                            <span className="font-semibold">
                                                {user.name || user.email}
                                            </span>
                                        </p>

                                        {isAdmin && (
                                            <p className="text-xs text-purple-600">
                                                Admin Access Enabled
                                            </p>
                                        )}

                                        <Button
                                            className="w-full"
                                            variant="outline"
                                            onClick={() => {
                                                setIsOpen(false);
                                                handleLogout();
                                            }}
                                        >
                                            Logout
                                        </Button>
                                    </div>
                                ) : (
                                    <Link to="/login" onClick={() => setIsOpen(false)}>
                                        <Button className="w-full">Login</Button>
                                    </Link>
                                )}

                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    );
};

export { Navbar };