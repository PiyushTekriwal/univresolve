import { useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Select } from '../components/ui/Select';
import { Label } from '../components/ui/Label';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createComplaint } from '../services/api';

const ComplaintForm = () => {
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        title: '',
        category: '',
        description: ''
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const rawUser = localStorage.getItem('user');
        if (!rawUser) {
            setError('Please login first to submit a complaint.');
            return;
        }

        let user;
        try {
            user = JSON.parse(rawUser);
        } catch {
            setError('Invalid login data. Please login again.');
            return;
        }

        if (!user?.id) {
            setError('Login expired. Please login again.');
            return;
        }

        setIsSubmitting(true);

        try {
            await createComplaint({
                title: formData.title,
                description: formData.description,
                category: formData.category,
                status: "open",
                user: { id: user.id }
            });
            setIsSubmitted(true);
        } catch (err) {
            console.error(err);
            setError(err?.message || 'Failed to submit complaint.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    if (isSubmitted) {
        return (
            <Layout>
                <div className="max-w-7xl mx-auto px-4 py-20 flex justify-center items-center min-h-[60vh]">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-white p-8 rounded-2xl shadow-lg border max-w-md w-full text-center"
                    >
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle2 className="h-10 w-10 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2">Complaint Submitted!</h2>
                        <p className="text-slate-600 mb-8">Your complaint has been registered. You can track its progress in your dashboard.</p>
                        <Link to="/dashboard">
                            <Button className="w-full">Go to Dashboard</Button>
                        </Link>
                    </motion.div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="max-w-3xl mx-auto px-4 py-10">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900">File a Complaint</h1>
                    <p className="text-slate-500 mt-2">Describe your issue and we'll make sure it reaches the right department.</p>
                </div>

                <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-6">
                    {error && (
                        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                            <AlertCircle className="h-5 w-5 flex-shrink-0" />
                            <p className="text-sm">{error}</p>
                        </div>
                    )}

                    <div>
                        <Label htmlFor="title">Issue Title</Label>
                        <Input
                            id="title"
                            name="title"
                            placeholder="e.g. Broken fan in Room 204"
                            required
                            value={formData.title}
                            onChange={handleChange}
                        />
                    </div>

                    <div>
                        <Label htmlFor="category">Category</Label>
                        <Select
                            id="category"
                            name="category"
                            value={formData.category}
                            onChange={handleChange}
                            required
                        >
                            <option value="">Select a category</option>
                            <option value="electrical">⚡ Electrical</option>
                            <option value="plumbing">🔧 Plumbing</option>
                            <option value="internet">🌐 Internet / WiFi</option>
                            <option value="hostel">🏠 Hostel Maintenance</option>
                            <option value="sanitation">🧹 Sanitation / Hygiene</option>
                            <option value="academics">📚 Academics</option>
                            <option value="mess">🍽️ Mess / Food</option>
                            <option value="security">🔒 Security</option>
                            <option value="other">📋 Other</option>
                        </Select>
                    </div>

                    <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            name="description"
                            placeholder="Describe the issue in detail — include location (hostel, block, room number) and any other relevant information..."
                            required
                            value={formData.description}
                            onChange={handleChange}
                            className="min-h-[120px]"
                        />
                    </div>

                    <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                        {isSubmitting ? "Submitting..." : "Submit Complaint"}
                    </Button>
                </form>
            </div>
        </Layout>
    );
};

export default ComplaintForm;