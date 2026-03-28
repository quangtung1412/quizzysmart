import React, { useState, useEffect } from 'react';
import { api } from '../src/api';
import { initSocket, disconnectSocket } from '../src/socket';

interface PremiumPlansScreenProps {
    onBack: () => void;
    user: any;
    onPurchaseSuccess?: () => void;
}

interface PlanDetails {
    id: string;
    planId: string;
    name: string;
    price: number;
    priceText: string;
    aiQuota: number;
    duration: number;
    durationText: string;
    features: string[];
    popular?: boolean;
    bestChoice?: boolean;
}

const PremiumPlansScreen: React.FC<PremiumPlansScreenProps> = ({ onBack, user, onPurchaseSuccess }) => {
    const [plans, setPlans] = useState<PlanDetails[]>([]);
    const [isLoadingPlans, setIsLoadingPlans] = useState(true);
    const [selectedPlan, setSelectedPlan] = useState<PlanDetails | null>(null);
    const [showPayment, setShowPayment] = useState(false);
    const [transactionCode, setTransactionCode] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingPayment, setIsLoadingPayment] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [paymentData, setPaymentData] = useState<any>(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [activatedPlan, setActivatedPlan] = useState<any>(null);

    // Load subscription plans from database
    useEffect(() => {
        const loadPlans = async () => {
            try {
                setIsLoadingPlans(true);
                const dbPlans = await api.getSubscriptionPlans();

                // Transform database plans to match PlanDetails interface
                const formattedPlans: PlanDetails[] = dbPlans.map((plan: any) => ({
                    id: plan.planId,
                    planId: plan.planId,
                    name: plan.name,
                    price: plan.price,
                    priceText: plan.priceText,
                    aiQuota: plan.aiQuota,
                    duration: plan.duration,
                    durationText: plan.durationText,
                    features: plan.features,
                    popular: plan.popular,
                    bestChoice: plan.bestChoice
                }));

                setPlans(formattedPlans);
            } catch (error) {
                console.error('Error loading subscription plans:', error);
                // Fallback to empty array if loading fails
                setPlans([]);
            } finally {
                setIsLoadingPlans(false);
            }
        };

        loadPlans();
    }, []);

    // Setup Socket.IO connection to listen for payment confirmation
    useEffect(() => {
        if (!user?.id) return;

        const socket = initSocket(user.id);

        // Listen for subscription activation from server
        socket.on('subscription-activated', (data: any) => {
            console.log('[Socket] Subscription activated:', data);

            // Show beautiful success modal
            setActivatedPlan(data);
            setShowSuccessModal(true);

            // Auto refresh after 5 seconds to show new premium status
            setTimeout(() => {
                if (onPurchaseSuccess) {
                    onPurchaseSuccess();
                }
                window.location.reload();
            }, 5000);
        });

        // Cleanup on unmount
        return () => {
            disconnectSocket();
        };
    }, [user?.id, onPurchaseSuccess]);

    const handleSelectPlan = async (plan: PlanDetails) => {
        setSelectedPlan(plan);
        setShowPayment(true);
        setMessage(null);
        setIsLoadingPayment(true);
        setPaymentData(null);

        try {
            // Call API to create PayOS payment link (backend will check for pending payment)
            const data = await api.createPaymentLink(plan.planId);

            // Check if this is an existing payment link
            if (data.isExisting) {
                console.log('[Payment] Reusing existing payment link');
                setMessage({
                    type: 'success',
                    text: '💡 Đã tìm thấy giao dịch chưa hoàn thành. Vui lòng hoàn tất thanh toán.'
                });
            }

            setPaymentData(data);
            setTransactionCode(data.description);
            setIsLoadingPayment(false);
        } catch (error: any) {
            console.error('Error creating payment link:', error);
            setMessage({
                type: 'error',
                text: error.message || 'Không thể tạo link thanh toán. Vui lòng thử lại.'
            });
            setIsLoadingPayment(false);
        }
    };

    const handleConfirmPayment = async () => {
        if (!selectedPlan || !paymentData) return;

        setIsSubmitting(true);
        setMessage(null);

        try {
            // Check payment status from PayOS
            const statusData = await api.checkPaymentStatus(paymentData.orderCode);

            if (statusData.paid) {
                setMessage({
                    type: 'success',
                    text: '✅ Thanh toán thành công! Tài khoản của bạn đã được nâng cấp. Đang tải lại...'
                });

                // Refresh user data and redirect
                setTimeout(() => {
                    if (onPurchaseSuccess) {
                        onPurchaseSuccess();
                    }
                    window.location.reload();
                }, 2000);
            } else if (statusData.status === 'PENDING' || statusData.status === 'pending') {
                setMessage({
                    type: 'error',
                    text: 'Giao dịch đang chờ xử lý. Hệ thống sẽ tự động kích hoạt khi nhận được xác nhận từ ngân hàng qua webhook.'
                });
            } else if (statusData.status === 'CANCELLED' || statusData.status === 'cancelled') {
                setMessage({
                    type: 'error',
                    text: 'Giao dịch đã bị hủy. Vui lòng tạo giao dịch mới.'
                });
            } else {
                setMessage({
                    type: 'error',
                    text: `Trạng thái thanh toán: ${statusData.status}. Vui lòng thử lại sau.`
                });
            }

        } catch (error: any) {
            console.error('Payment check error:', error);
            setMessage({
                type: 'error',
                text: error.message || 'Không thể kiểm tra trạng thái thanh toán. Vui lòng thử lại.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Success Modal Component
    const SuccessModal = () => {
        if (!showSuccessModal || !activatedPlan) return null;

        // Use planName from server if available, otherwise fall back to plan ID
        const planName = activatedPlan.planName || activatedPlan.plan || 'Premium';

        // Determine color based on plan ID (more flexible for multiple plans)
        let planColor = 'from-purple-500 to-pink-500'; // default
        if (activatedPlan.plan === 'plus') {
            planColor = 'from-blue-500 to-cyan-500';
        } else if (activatedPlan.plan === 'premium') {
            planColor = 'from-purple-500 to-pink-500';
        } else if (activatedPlan.plan === 'max') {
            planColor = 'from-emerald-500 to-teal-500';
        } else {
            planColor = 'from-green-500 to-emerald-500';
        }

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm animate-fadeIn">
                <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden animate-slideUp">
                    {/* Header with gradient */}
                    <div className={`bg-gradient-to-r ${planColor} px-8 py-12 text-center relative overflow-hidden`}>
                        {/* Decorative circles */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-16 -mt-16"></div>
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-10 rounded-full -ml-12 -mb-12"></div>

                        {/* Success icon */}
                        <div className="relative z-10">
                            <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full mb-4 shadow-lg animate-bounce">
                                <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h2 className="text-3xl font-bold text-white mb-2">
                                Thanh toán thành công!
                            </h2>
                            <p className="text-white text-opacity-90 text-lg">
                                Chào mừng bạn đến với gói {planName}
                            </p>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="px-8 py-8">
                        {/* Thank you message */}
                        <div className="text-center mb-6">
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-amber-400 to-yellow-400 rounded-full mb-4">
                                <span className="text-3xl">🙏</span>
                            </div>
                            <h3 className="text-2xl font-bold text-slate-800 mb-3">
                                Cảm ơn bạn rất nhiều!
                            </h3>
                            <p className="text-slate-600 text-base leading-relaxed">
                                Sự ủng hộ của bạn giúp đội ngũ chúng tôi có thêm kinh phí để duy trì và phát triển website,
                                mang đến những tính năng tốt hơn cho cộng đồng.
                            </p>
                        </div>

                        {/* Plan details */}
                        <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-6 mb-6">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-slate-600 font-medium">Gói đã kích hoạt:</span>
                                <span className={`px-4 py-2 rounded-full text-white font-bold text-sm bg-gradient-to-r ${planColor}`}>
                                    {planName}
                                </span>
                            </div>
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-slate-600 font-medium">AI Search Quota:</span>
                                <span className="text-green-600 font-bold text-lg">
                                    +{activatedPlan.aiQuota} lượt
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-600 font-medium">Hết hạn:</span>
                                <span className="text-slate-700 font-semibold">
                                    {new Date(activatedPlan.expiresAt).toLocaleDateString('vi-VN')}
                                </span>
                            </div>
                        </div>

                        {/* Features unlocked */}
                        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 mb-6">
                            <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mt-0.5">
                                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="font-semibold text-green-800 mb-1">
                                        Tất cả tính năng Premium đã được kích hoạt
                                    </p>
                                    <p className="text-green-700 text-sm">
                                        Trang sẽ tự động tải lại sau vài giây để cập nhật trạng thái mới của bạn.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Action button */}
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full py-4 px-6 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                        >
                            Khám phá ngay
                        </button>

                        {/* Auto reload countdown */}
                        <p className="text-center text-slate-500 text-sm mt-4">
                            ⏱️ Tự động tải lại sau 5 giây...
                        </p>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-6xl mx-auto px-4 py-6">
            {/* Success Modal */}
            <SuccessModal />

            {/* Header */}
            <div className="mb-8">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-4"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                    Quay lại
                </button>

                <div className="text-center">
                    <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-white px-6 py-2 rounded-full text-sm font-bold mb-4 shadow-lg">
                        ✨ GÓI PREMIUM
                    </div>
                    <h1 className="text-4xl font-bold text-slate-800 mb-4">
                        Nâng cấp tài khoản
                    </h1>
                    <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                        Mở khóa toàn bộ tính năng và tận hưởng trải nghiệm học tập tối ưu
                    </p>
                </div>
            </div>

            {/* Plans */}
            {!showPayment ? (
                isLoadingPlans ? (
                    <div className="text-center py-12">
                        <svg className="animate-spin h-12 w-12 mx-auto text-amber-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p className="text-slate-600">Đang tải thông tin gói...</p>
                    </div>
                ) : plans.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-slate-600 text-lg mb-4">Hiện tại chưa có gói Premium nào khả dụng</p>
                        <button
                            onClick={onBack}
                            className="px-6 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors"
                        >
                            Quay lại
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                        {plans.map((plan) => (
                            <div
                                key={plan.id}
                                className={`relative bg-white rounded-2xl shadow-xl p-8 transition-all hover:shadow-2xl hover:scale-105 ${plan.bestChoice
                                    ? 'border-4 border-green-500 shadow-2xl ring-4 ring-green-200'
                                    : plan.popular
                                        ? 'border-2 border-amber-400'
                                        : 'border-2 border-slate-200'
                                    }`}
                            >
                                {plan.bestChoice && (
                                    <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 z-10">
                                        <div className="relative">
                                            <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-500 blur-lg opacity-75 animate-pulse"></div>
                                            <span className="relative bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-2 rounded-full text-sm font-bold shadow-2xl flex items-center gap-2">
                                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                </svg>
                                                BEST CHOICE
                                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                </svg>
                                            </span>
                                        </div>
                                    </div>
                                )}
                                {!plan.bestChoice && plan.popular && (
                                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                                        <span className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white px-4 py-1 rounded-full text-xs font-bold shadow-lg">
                                            🔥 PHỔ BIẾN NHẤT
                                        </span>
                                    </div>
                                )}

                                <div className="text-center mb-6">
                                    <h3 className="text-2xl font-bold text-slate-800 mb-2">{plan.name}</h3>
                                    <div className="flex items-baseline justify-center gap-1">
                                        <span className="text-4xl font-bold text-amber-600">{plan.priceText}</span>
                                        <span className="text-slate-500">/ {plan.durationText}</span>
                                    </div>
                                </div>

                                <div className="space-y-4 mb-8">
                                    {plan.features.map((feature, index) => (
                                        <div key={index} className="flex items-start gap-3">
                                            <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            <span className="text-slate-700">{feature}</span>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    onClick={() => handleSelectPlan(plan)}
                                    className={`w-full py-3 px-6 rounded-xl font-bold transition-all ${plan.bestChoice
                                        ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                                        : plan.popular
                                            ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white shadow-lg'
                                            : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                                        }`}
                                >
                                    Chọn gói {plan.name}
                                </button>
                            </div>
                        ))}
                    </div>
                )
            ) : (
                // Payment Screen
                <div className="max-w-2xl mx-auto">
                    <div className="bg-white rounded-2xl shadow-xl p-8">
                        <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">
                            Thanh toán gói {selectedPlan?.name}
                        </h2>

                        {/* QR Code Section */}
                        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-lg p-4 mb-4">
                            {isLoadingPayment ? (
                                <div className="text-center py-12">
                                    <svg className="animate-spin h-12 w-12 mx-auto text-amber-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <p className="text-slate-600">Đang tạo mã QR...</p>
                                </div>
                            ) : paymentData ? (
                                <>
                                    <div className="text-center mb-3">
                                        <h3 className="font-bold text-base mb-2">Quét mã QR chuyển khoản</h3>
                                        <p className="text-xs text-slate-600">NH: <strong>{paymentData.bin}</strong> | STK: <strong>{paymentData.accountNumber}</strong> | <strong>{paymentData.accountName}</strong></p>
                                    </div>

                                    {/* QR Code from PayOS */}
                                    <div className="bg-white rounded-lg p-2 flex justify-center items-center">
                                        {paymentData.qrCode ? (
                                            <div className="flex flex-col items-center">
                                                <img
                                                    src={`data:image/png;base64,${paymentData.qrCode}`}
                                                    alt="QR Code thanh toán"
                                                    className="w-64 h-64 object-contain rounded"
                                                    onError={(e) => {
                                                        console.error('QR code failed to load');
                                                        e.currentTarget.style.display = 'none';
                                                        const parent = e.currentTarget.parentElement;
                                                        if (parent) {
                                                            parent.innerHTML = '<div class="w-64 h-64 bg-slate-100 rounded flex items-center justify-center"><div class="text-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg><p class="text-xs text-slate-500">QR không thể hiển thị</p></div></div>';
                                                        }
                                                    }}
                                                />
                                                <p className="text-xs text-slate-500 mt-1">Quét để thanh toán</p>
                                            </div>
                                        ) : paymentData.checkoutUrl ? (
                                            <div className="w-64 h-64 bg-gradient-to-br from-blue-50 to-indigo-50 rounded flex items-center justify-center p-4">
                                                <div className="text-center">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-blue-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                                    </svg>
                                                    <p className="text-xs text-slate-700 font-medium mb-1">QR không khả dụng</p>
                                                    <p className="text-xs text-slate-500">Dùng link thanh toán</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="w-64 h-64 bg-slate-100 rounded flex items-center justify-center">
                                                <div className="text-center">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                                    </svg>
                                                    <p className="text-xs text-slate-500">QR không khả dụng</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Transfer Details */}
                                    <div className="mt-3 space-y-1.5">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-slate-600">Số tiền:</span>
                                            <span className="font-bold text-base text-amber-600">{paymentData.amount.toLocaleString()}đ</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-slate-600">Nội dung:</span>
                                            <div className="flex items-center gap-1.5">
                                                <code className="bg-white px-2 py-1 rounded text-xs font-mono">
                                                    {paymentData.description}
                                                </code>
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(paymentData.description);
                                                        alert('Đã copy!');
                                                    }}
                                                    className="p-1 hover:bg-white rounded"
                                                    title="Copy"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-600" viewBox="0 0 20 20" fill="currentColor">
                                                        <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                                        <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-slate-600">Mã đơn:</span>
                                            <code className="bg-white px-2 py-1 rounded text-xs font-mono">
                                                {paymentData.orderCode}
                                            </code>
                                        </div>
                                    </div>

                                    {/* Link thanh toán */}
                                    {paymentData.checkoutUrl && (
                                        <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                                            <p className="text-xs text-blue-800 mb-2">
                                                💳 Thanh toán qua trình duyệt/app ngân hàng
                                            </p>
                                            <a
                                                href={paymentData.checkoutUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-all shadow-md hover:shadow-lg transform hover:scale-105 text-sm"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                    <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                                                    <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                                                </svg>
                                                Mở PayOS
                                            </a>
                                        </div>
                                    )}

                                    <div className="mt-3 bg-amber-100 rounded-lg p-2">
                                        <p className="text-xs text-amber-800 font-semibold">
                                            ⚠️ Nhập đúng nội dung CK để xác nhận tự động
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-red-600 text-sm">Không thể tạo QR. Vui lòng thử lại.</p>
                                </div>
                            )}
                        </div>

                        {/* Message */}
                        {message && (
                            <div className={`rounded-lg p-4 mb-4 ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
                                }`}>
                                <div className="flex items-start gap-2">
                                    {message.type === 'success' ? (
                                        <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                    <p className="text-sm">{message.text}</p>
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-4">
                            <button
                                onClick={() => {
                                    setShowPayment(false);
                                    setSelectedPlan(null);
                                    setPaymentData(null);
                                    setMessage(null);
                                }}
                                disabled={isSubmitting || isLoadingPayment}
                                className="flex-1 py-3 px-6 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-400 text-slate-800 font-semibold rounded-xl transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleConfirmPayment}
                                disabled={isSubmitting || isLoadingPayment || !paymentData}
                                className="flex-1 py-3 px-6 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-slate-400 disabled:to-slate-400 text-white font-bold rounded-xl transition-all shadow-lg disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Đang kiểm tra...
                                    </span>
                                ) : (
                                    'Đã chuyển khoản'
                                )}
                            </button>
                        </div>

                        <p className="text-xs text-slate-500 text-center mt-3">
                            💡 Hệ thống tự động kích hoạt sau khi nhận xác nhận từ ngân hàng. Nếu chưa kích hoạt, bấm "Đã chuyển khoản".
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PremiumPlansScreen;
