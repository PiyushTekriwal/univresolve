import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/Button';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ClipboardList, CheckCircle, Clock, ArrowRight } from 'lucide-react';

const Home = () => {
    const fadeInUp = {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.5 }
    };

    const features = [
        {
            icon: <ClipboardList className="h-8 w-8 text-primary-600" />,
            title: "Easy Reporting",
            description: "Submit complaints about hostels, electrical issues, sanitation, or academic concerns in seconds."
        },
        {
            icon: <Clock className="h-8 w-8 text-primary-600" />,
            title: "Real-time Tracking",
            description: "Monitor the status of your complaint from submission to resolution with live updates."
        },
        {
            icon: <CheckCircle className="h-8 w-8 text-primary-600" />,
            title: "Quick Resolution",
            description: "Direct channel to the administration ensures your problems are heard and resolved efficiently."
        }
    ];

    return (
        <Layout>
            {/* Hero Section */}
            <section className="relative bg-white overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary-50 to-white -z-10" />
                <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-primary-100 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob" />
                <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-96 h-96 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000" />

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
                    <div className="text-center max-w-3xl mx-auto">
                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                            className="text-4xl md:text-6xl font-extrabold text-slate-900 tracking-tight mb-6"
                        >
                            A Better Campus Experience, <br />
                            <span className="text-primary-600">One Resolution at a Time</span>
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.1 }}
                            className="text-lg md:text-xl text-slate-600 mb-10 leading-relaxed"
                        >
                            UNIV-Resolve is your dedicated platform for addressing campus issues.
                            Report problems, track progress, and help us maintain a world-class environment.
                        </motion.p>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            className="flex flex-col sm:flex-row justify-center gap-4"
                        >
                            <Link to="/complaint">
                                <Button size="lg" className="w-full sm:w-auto group">
                                    File a Complaint
                                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                </Button>
                            </Link>
                            <Link to="/dashboard">
                                <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                                    Track Status
                                </Button>
                            </Link>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-20 bg-slate-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-slate-900 mb-4">How It Works</h2>
                        <p className="text-slate-600 max-w-2xl mx-auto">Simple, transparent, and effective. We've streamlined the process to get your issues resolved as quickly as possible.</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {features.map((feature, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                                className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-slate-100"
                            >
                                <div className="bg-primary-50 w-16 h-16 rounded-xl flex items-center justify-center mb-6">
                                    {feature.icon}
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                                <p className="text-slate-600 leading-relaxed">
                                    {feature.description}
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="bg-primary-900 rounded-3xl p-8 md:p-16 text-center text-white overflow-hidden relative">
                        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-primary-700 rounded-full opacity-50 blur-3xl" />
                        <div className="relative z-10">
                            <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to make a difference?</h2>
                            <p className="text-primary-100 text-lg mb-8 max-w-2xl mx-auto">
                                Don't let issues linger. Report them now and help us keep UNIV beautiful and functional.
                            </p>
                            <Link to="/complaint">
                                <Button size="lg" className="bg-white text-primary-900 hover:bg-slate-100">
                                    Get Started
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
        </Layout>
    );
};

export default Home;
