import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { loginUser } from "../services/api";

const Login = () => {

    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {

        e.preventDefault();

        if (!email.endsWith("@kiit.ac.in")) {
            setError("Only university email IDs (@kiit.ac.in) are allowed");
            return;
        }

        try {
            setLoading(true);

            const user = await loginUser({
                email,
                password
            });

            localStorage.setItem("user", JSON.stringify(user));

            if (user?.role?.toLowerCase() === "admin") {
                navigate("/admin");
            } else {
                navigate("/dashboard");
            }

        } catch (err) {
            setError("Invalid email or password");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen grid md:grid-cols-2">

            {/* Left Side */}
            <div className="flex flex-col justify-center p-8 md:p-16 bg-white">

                <div className="max-w-md w-full mx-auto">

                    <Link to="/" className="flex items-center space-x-2 mb-8 group w-fit">
                        <div className="bg-primary-600 p-2 rounded-lg group-hover:bg-primary-700 transition-colors">
                            <ShieldCheck className="h-6 w-6 text-white" />
                        </div>
                        <span className="font-bold text-xl text-slate-800 tracking-tight">
                            UNIV<span className="text-primary-600">Resolve</span>
                        </span>
                    </Link>

                    <h1 className="text-3xl font-bold text-slate-900 mb-2">
                        Welcome Back
                    </h1>

                    <p className="text-slate-500 mb-8">
                        Sign in to your account to file or track complaints.
                    </p>

                    {error && (
                        <p className="text-red-500 text-sm mb-4">
                            {error}
                        </p>
                    )}

                    <form className="space-y-4" onSubmit={handleLogin}>

                        <div>
                            <Label htmlFor="email">Email</Label>

                            <Input
                                id="email"
                                type="email"
                                placeholder="roll_number@kiit.ac.in"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <Label htmlFor="password">Password</Label>
                            </div>

                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        <Button className="w-full" size="lg" type="submit" disabled={loading}>
                            {loading ? "Signing in..." : <>Sign In <ArrowRight className="ml-2 h-4 w-4" /></>}
                        </Button>

                    </form>

                    <div className="mt-6 text-center text-sm text-slate-500">
                        Don't have an account?{" "}
                        <Link
                            to="/register"
                            className="font-medium text-primary-600 hover:text-primary-500"
                        >
                            Register
                        </Link>
                    </div>

                </div>
            </div>

            {/* Right Side Image */}
            <div className="hidden md:block bg-slate-900 relative overflow-hidden">

                <div className="absolute inset-0 bg-gradient-to-br from-primary-900 to-slate-900 opacity-90" />

                <img
                    src="https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=2070&auto=format&fit=crop"
                    alt="University Campus"
                    className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-50"
                />

                <div className="absolute inset-0 flex items-center justify-center p-16">

                    <div className="max-w-lg text-white">

                        <h2 className="text-4xl font-bold mb-6">
                            Empowering Student Voices
                        </h2>

                        <p className="text-lg text-slate-300 leading-relaxed">
                            "A safe and functional campus is the foundation of academic excellence.
                            Use UNIV-Resolve to ensure your environment supports your success."
                        </p>

                    </div>

                </div>

            </div>

        </div>
    );
};

export default Login;