import React, { useState } from 'react';
import { createBeneficiary } from '../services/api';
import { normalizePhoneNumber, validatePhoneNumber, isValidFullName } from '../utils/phone';
import Logo from '../components/Logo';
import './auth.css';

const AddBeneficiary = ({ onNext, onBack }) => {
    const [beneficiaries, setBeneficiaries] = useState([]);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [errors, setErrors] = useState({});
    const [isShaking, setIsShaking] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [focusedField, setFocusedField] = useState(null);
    const [editingIndex, setEditingIndex] = useState(null);

    // Validation logic
    const validateForm = () => {
        const newErrors = {};
        if (!isValidFullName(name)) {
            newErrors.name = 'Please enter a valid name (at least 2 letters)';
        }
        const phoneVal = validatePhoneNumber(phone);
        if (!phoneVal.valid) {
            newErrors.phone = phoneVal.error || 'Enter a valid mobile number (e.g. 08012345678)';
        }
        return newErrors;
    };

    // Add or update beneficiary
    const handleAddBeneficiary = (e) => {
        e.preventDefault();
        const newErrors = validateForm();

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            setIsShaking(true);
            setTimeout(() => setIsShaking(false), 500);
            return;
        }

        const normalizedPhone = normalizePhoneNumber(phone)

        if (editingIndex !== null) {
            // Update existing beneficiary
            const updatedBeneficiaries = [...beneficiaries];
            updatedBeneficiaries[editingIndex] = { name, phone: normalizedPhone };
            setBeneficiaries(updatedBeneficiaries);
            setEditingIndex(null);
        } else {
            // Add new beneficiary
            setBeneficiaries([...beneficiaries, { name, phone: normalizedPhone }]);
        }

        // Clear form
        setName('');
        setPhone('');
        setErrors({});
    };

    // Edit beneficiary
    const handleEdit = (index) => {
        setName(beneficiaries[index].name);
        setPhone(beneficiaries[index].phone);
        setEditingIndex(index);
    };

    // Delete beneficiary
    const handleDelete = (index) => {
        setBeneficiaries(beneficiaries.filter((_, i) => i !== index));
    };

    // Handle form submission (Save & Continue)
    const handleSubmit = async () => {
        if (beneficiaries.length === 0) {
            setErrors({ general: 'Please add at least one emergency contact' })
            setIsShaking(true)
            setTimeout(() => setIsShaking(false), 500)
            return
        }

        setIsLoading(true)
        setErrors({})

        const saved = []
        const failed = []

        try {
            // Save all beneficiaries to the real API — track individual failures
            for (const b of beneficiaries) {
                try {
                    await createBeneficiary({ name: b.name, phone: normalizePhoneNumber(b.phone) })
                    saved.push(b.name)
                } catch (err) {
                    failed.push(b.name)
                    console.error(`Failed to save contact ${b.name}:`, err)
                }
            }

            if (failed.length > 0 && saved.length === 0) {
                // All failed
                setErrors({ general: `Failed to save contacts. Please check your connection and try again.` })
                return
            } else if (failed.length > 0) {
                // Partial success — warn but continue
                setErrors({ general: `Saved ${saved.length} contact(s). Could not save: ${failed.join(', ')}. You can add them again later.` })
                setTimeout(() => onNext(beneficiaries.filter(b => saved.includes(b.name))), 2500)
                return
            }

            setIsSuccess(true)
            setTimeout(() => {
                onNext(beneficiaries)
            }, 1000)
        } finally {
            setIsLoading(false)
        }
    }

    // Inline styles
    const styles = {
        container: {
            minHeight: '100dvh',
            width: '100%',
            maxWidth: '100vw',
            boxSizing: 'border-box',
            overflowY: 'auto',
            background: '#080810',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            padding: 'calc(32px + env(safe-area-inset-top, 0px)) 20px calc(180px + env(safe-area-inset-bottom, 0px)) 20px',
            fontFamily: 'Inter, sans-serif',
            color: '#e2e8f0',
            position: 'relative',
        },
        contentWrapper: {
            width: '100%',
            maxWidth: '480px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            zIndex: 1,
        },
        logoSection: {
            textAlign: 'center',
            marginBottom: '20px',
            marginTop: '10px',
        },
        logo: {
            fontSize: '32px',
            fontWeight: 'bold',
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
        },
        logoVibe: {
            color: '#e2e8f0',
            fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
        },
        logoMap: {
            background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
        },
        pinIcon: {
            color: '#8b5cf6',
            fontSize: '24px',
        },
        progressSection: {
            width: '100%',
            marginBottom: '24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px',
        },
        progressBar: {
            width: '100%',
            height: '6px',
            background: 'rgba(139, 92, 246, 0.15)',
            borderRadius: '3px',
            overflow: 'hidden',
            display: 'flex',
        },
        progressFill: {
            width: '50%',
            height: '100%',
            background: '#06b6d4',
            boxShadow: '0 0 10px rgba(6, 182, 212, 0.6)',
            transition: 'width 0.3s ease',
        },
        progressLabel: {
            fontSize: '12px',
            fontWeight: '600',
            color: '#06b6d4',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
        },
        card: {
            width: '100%',
            padding: '32px 24px 28px 24px',
            animation: isShaking ? 'shake 0.35s ease-in-out' : 'none',
        },
        heading: {
            fontSize: '24px',
            fontWeight: 'bold',
            fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
            color: '#e2e8f0',
            textAlign: 'center',
            marginBottom: '12px',
            lineHeight: '1.3',
        },
        subtitle: {
            fontSize: '14px',
            color: '#64748b',
            textAlign: 'center',
            marginBottom: '32px',
            lineHeight: '1.5',
        },
        inputGroup: {
            marginBottom: '20px',
        },
        label: {
            fontSize: '12px',
            fontWeight: '600',
            color: '#06b6d4',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '8px',
            display: 'block',
        },
        inputWrapper: {
            width: '100%',
            marginBottom: 0,
        },
        input: {
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#e2e8f0',
            fontSize: '14px',
            fontFamily: 'Inter, sans-serif',
            paddingLeft: 4,
        },
        errorText: {
            fontSize: '12px',
            color: '#ef4444',
            marginTop: '6px',
            display: 'block',
        },
        privacyBox: {
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            marginTop: '28px',
            marginBottom: '24px',
        },
        privacyIcon: {
            color: '#06b6d4',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
        },
        privacyContent: {
            flex: 1,
        },
        privacyTitle: {
            fontSize: '14px',
            fontWeight: '600',
            color: '#e2e8f0',
            marginBottom: '4px',
        },
        privacyText: {
            fontSize: '12px',
            color: '#64748b',
            lineHeight: '1.4',
        },
        lockIcon: {
            color: '#64748b',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
        },
        beneficiariesList: {
            width: '100%',
            marginTop: '28px',
        },
        beneficiariesTitle: {
            fontSize: '14px',
            fontWeight: '600',
            color: '#06b6d4',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '16px',
            display: 'block',
        },
        beneficiaryItem: {
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            transition: 'all 0.3s ease',
        },
        beneficiaryInfo: {
            flex: 1,
        },
        beneficiaryName: {
            fontSize: '14px',
            fontWeight: '600',
            color: '#e2e8f0',
            marginBottom: '4px',
        },
        beneficiaryPhone: {
            fontSize: '12px',
            color: '#64748b',
        },
        beneficiaryActions: {
            display: 'flex',
            gap: '8px',
        },
        actionButton: (type) => ({
            padding: '8px 12px',
            background: type === 'edit' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${type === 'edit' ? '#8b5cf6' : '#ef4444'}`,
            borderRadius: '8px',
            color: type === 'edit' ? '#a78bfa' : '#fca5a5',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
        }),
        addButton: {
            width: '100%',
            padding: '14px 16px',
            background: 'rgba(139, 92, 246, 0.1)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '12px',
            color: '#a78bfa',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
        },
        stickyBottom: {
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'linear-gradient(180deg, rgba(8, 8, 16, 0) 0%, rgba(8, 8, 16, 0.98) 35%)',
            padding: '24px 20px 32px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            zIndex: 100,
        },
        stickyContent: {
            width: '100%',
            maxWidth: '480px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
        },
        button: {
            width: '100%',
            padding: '16px 24px',
            border: 'none',
            color: isSuccess ? '#e2e8f0' : '#080810',
            fontSize: '16px',
            fontWeight: 'bold',
            fontFamily: 'Inter, sans-serif',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.3s ease',
            opacity: isLoading ? 0.7 : 1,
        },
        buttonIcon: {
            fontSize: '18px',
            display: 'flex',
            alignItems: 'center',
        },
        backLink: {
            fontSize: '14px',
            color: '#64748b',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'color 0.3s ease',
            textDecoration: 'none',
            background: 'none',
            border: 'none',
            padding: 0,
            fontFamily: 'Inter, sans-serif',
        },
        generalError: {
            fontSize: '12px',
            color: '#ef4444',
            textAlign: 'center',
            marginBottom: '16px',
            padding: '12px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '6px',
        },
    };

    // Google Fonts import
    const fontImport = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
  `;

    return (
        <>
            <style>{fontImport}</style>
            <div style={styles.container}>
                {/* Background Glows */}
                <div className="auth-bg-glow-1" />
                <div className="auth-bg-glow-2" />

                <div style={styles.contentWrapper}>
                    {/* Unified Brand Logo */}
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                        <Logo size="md" />
                    </div>

                    {/* Progress Section */}
                    <div style={styles.progressSection}>
                        <div style={styles.progressBar}>
                            <div style={styles.progressFill}></div>
                        </div>
                        <div style={styles.progressLabel}>Step 1 of 2</div>
                    </div>

                    {/* Main Card */}
                    <form className="auth-card" style={styles.card} onSubmit={handleAddBeneficiary}>
                        <h1 style={styles.heading}>Add an emergency contact</h1>
                        <p style={styles.subtitle}>
                            In case of an emergency, we'll notify your contact right away.
                        </p>

                        {/* Name Input */}
                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Name</label>
                            <div className={`auth-input-wrapper ${focusedField === 'name' ? 'focused' : ''} ${errors.name ? 'error' : ''}`} style={styles.inputWrapper}>
                                <span className="auth-input-icon">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                </span>
                                <input
                                    type="text"
                                    placeholder="Enter full name"
                                    value={name}
                                    onChange={(e) => {
                                        setName(e.target.value);
                                        if (errors.name) setErrors({ ...errors, name: '' });
                                    }}
                                    onFocus={() => setFocusedField('name')}
                                    onBlur={() => setFocusedField(null)}
                                    style={styles.input}
                                    required
                                />
                            </div>
                            {errors.name && <span style={styles.errorText}>{errors.name}</span>}
                        </div>

                        {/* Phone Input */}
                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Phone</label>
                            <div className={`auth-input-wrapper ${focusedField === 'phone' ? 'focused' : ''} ${errors.phone ? 'error' : ''}`} style={styles.inputWrapper}>
                                <span className="auth-input-icon">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                                </span>
                                <span style={{ color: '#e2e8f0', fontSize: 13, flexShrink: 0, fontFamily: 'Inter, sans-serif', paddingRight: 6, borderRight: '1px solid rgba(255,255,255,0.08)' }}>🇳🇬 +234</span>
                                <input
                                    type="tel"
                                    placeholder="0800 000 0000"
                                    maxLength={11}
                                    value={phone}
                                    onChange={(e) => {
                                        const nextValue = e.target.value
                                        setPhone(nextValue);
                                        if (errors.phone) setErrors({ ...errors, phone: '' });
                                    }}
                                    onFocus={() => setFocusedField('phone')}
                                    onBlur={() => setFocusedField(null)}
                                    style={{ ...styles.input, paddingLeft: 8 }}
                                    required
                                />
                            </div>
                            {errors.phone && <span style={styles.errorText}>{errors.phone}</span>}
                        </div>

                        {/* Privacy Notice */}
                        <div style={styles.privacyBox}>
                            <span style={styles.privacyIcon}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                            </span>
                            <div style={styles.privacyContent}>
                                <div style={styles.privacyTitle}>Your contact stays private</div>
                                <div style={styles.privacyText}>
                                    We'll only use this information in case of an emergency.
                                </div>
                            </div>
                            <span style={styles.lockIcon}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                            </span>
                        </div>

                        {/* Add/Update Button */}
                        <button
                            type="submit"
                            style={styles.addButton}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(139, 92, 246, 0.2)';
                                e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.5)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
                                e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)';
                            }}
                        >
                            <span style={styles.buttonIcon}>
                                {editingIndex !== null ? (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                ) : (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                )}
                            </span>
                            {editingIndex !== null ? 'Update Contact' : 'Add Contact'}
                        </button>
                    </form>

                    {/* Beneficiaries List */}
                    {beneficiaries.length > 0 && (
                        <div style={styles.beneficiariesList}>
                            <span style={styles.beneficiariesTitle}>
                                Added Contacts ({beneficiaries.length})
                            </span>
                            {(Array.isArray(beneficiaries) ? beneficiaries : []).map((beneficiary, index) => (
                                <div
                                    key={beneficiary.phone || index}
                                    style={styles.beneficiaryItem}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                        e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                                    }}
                                >
                                    <div style={styles.beneficiaryInfo}>
                                        <div style={styles.beneficiaryName}>{beneficiary.name}</div>
                                        <div style={styles.beneficiaryPhone}>{beneficiary.phone}</div>
                                    </div>
                                    <div style={styles.beneficiaryActions}>
                                        <button
                                            onClick={() => handleEdit(index)}
                                            style={styles.actionButton('edit')}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = 'rgba(139, 92, 246, 0.2)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
                                            }}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(index)}
                                            style={styles.actionButton('delete')}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                                            }}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Sticky Bottom Section */}
            <div style={styles.stickyBottom}>
                <div style={styles.stickyContent}>
                    {errors.general && <div style={styles.generalError}>{errors.general}</div>}
                    <button
                        onClick={handleSubmit}
                        className={isSuccess ? 'auth-btn-primary' : 'auth-btn-secondary'}
                        style={styles.button}
                        disabled={isLoading}
                        onMouseEnter={(e) => {
                            if (!isLoading) {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        {isLoading ? (
                            <>
                                <span className="buttonIcon" style={{ animation: 'spin 1.5s linear infinite', marginRight: 8 }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="6.34" y1="17.66" x2="4.93" y2="19.07"/><line x1="19.07" y1="4.93" x2="17.66" y2="6.34"/></svg>
                                </span>
                                Saving...
                            </>
                        ) : isSuccess ? (
                            <>
                                <span style={{ ...styles.buttonIcon, marginRight: 8 }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                </span>
                                Saved!
                            </>
                        ) : (
                            <>
                                <span style={{ ...styles.buttonIcon, marginRight: 8 }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                </span>
                                Save & Continue
                                <span style={{ ...styles.buttonIcon, marginLeft: 8 }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                                </span>
                            </>
                        )}
                    </button>
                    <button
                        onClick={onBack}
                        style={styles.backLink}
                        onMouseEnter={(e) => (e.target.style.color = '#06b6d4')}
                        onMouseLeave={(e) => (e.target.style.color = '#64748b')}
                    >
                        &lt; Back
                    </button>
                </div>
            </div>

            {/* Spin animation for loader */}
            <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
        </>
    );
};

export default AddBeneficiary;