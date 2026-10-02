import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  Pencil,
  Trash2,
  Users,
  Save,
  Check,
  X
} from 'lucide-react';
import { getBeneficiaries, updateBeneficiary, deleteBeneficiary } from '../services/api';
import { normalizePhoneNumber, validatePhoneNumber, isValidFullName } from '../utils/phone';

const ManageBeneficiaries = ({ onSave, onBack }) => {
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    getBeneficiaries()
      .then(res => setBeneficiaries(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoadingData(false))
  }, [])
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  // Validation logic
  const validateForm = () => {
    const newErrors = {};
    if (!isValidFullName(editName)) {
      newErrors.name = 'Enter a valid name (at least 2 letters)';
    }
    const phoneVal = validatePhoneNumber(editPhone);
    if (!phoneVal.valid) {
      newErrors.phone = phoneVal.error || 'Enter a valid mobile number (e.g. 08012345678)';
    }
    return newErrors;
  };

  // Start editing
  const handleEdit = (id) => {
    const beneficiary = beneficiaries.find((b) => b.id === id);
    if (beneficiary) {
      setEditingId(id);
      setEditName(beneficiary.name);
      setEditPhone(beneficiary.phone);
      setErrors({});
    }
  };

  // Save edited beneficiary
 const handleSaveEdit = async () => {
  const newErrors = validateForm()
  if (Object.keys(newErrors).length > 0) {
    setErrors(newErrors)
    return
  }
  const normalizedPhone = normalizePhoneNumber(editPhone)
  try {
    await updateBeneficiary(editingId, { name: editName, phone: normalizedPhone })
    const updatedBeneficiaries = (Array.isArray(beneficiaries) ? beneficiaries : []).map((b) =>
      b.id === editingId ? { ...b, name: editName, phone: normalizedPhone } : b
    )
    setBeneficiaries(updatedBeneficiaries)
    setEditingId(null)
    setEditName('')
    setEditPhone('')
    setErrors({})
  } catch (err) {
    setErrors({ general: err.response?.data?.detail || 'Failed to update contact' })
  }
}
  // Cancel editing
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditPhone('');
    setErrors({});
  };

  // Delete beneficiary
  const handleDelete = async (id) => {
    try {
      await deleteBeneficiary(id)
      setBeneficiaries(beneficiaries.filter((b) => b.id !== id))
      setShowDeleteConfirm(null)
      window.dispatchEvent(new CustomEvent('vibemap-beneficiaries-updated'))
    } catch (err) {
      setErrors({ general: err.response?.data?.detail || 'Failed to delete contact' })
      setShowDeleteConfirm(null)
    }
  }

  // Save all changes
 const handleSaveAll = () => {
  if (beneficiaries.length === 0) {
    setErrors({ general: 'You must have at least one emergency contact' })
    return
  }
  setIsSuccess(true)
  setTimeout(() => {
    if (onSave) onSave(beneficiaries)
  }, 1000)
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
      padding: 'calc(20px + env(safe-area-inset-top, 0px)) 20px calc(180px + env(safe-area-inset-bottom, 0px)) 20px',
      fontFamily: 'Inter, sans-serif',
      color: '#e2e8f0',
    },
    contentWrapper: {
      width: '100%',
      maxWidth: '480px',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    },
    header: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '30px',
      marginTop: '20px',
    },
    backButton: {
      background: 'none',
      border: 'none',
      color: '#06b6d4',
      fontSize: '24px',
      cursor: 'pointer',
      padding: 0,
      transition: 'color 0.3s ease',
    },
    title: {
      fontSize: '24px',
      fontWeight: 'bold',
      fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
      color: '#e2e8f0',
      flex: 1,
      textAlign: 'center',
    },
    placeholder: {
      width: '24px',
    },
    subtitle: {
      fontSize: '14px',
      color: '#64748b',
      textAlign: 'center',
      marginBottom: '32px',
      lineHeight: '1.5',
    },
    beneficiariesContainer: {
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      marginBottom: '24px',
    },
    beneficiaryCard: (isEditing) => ({
      background: isEditing ? 'rgba(139, 92, 246, 0.1)' : 'rgba(18, 18, 26, 0.9)',
      backdropFilter: 'blur(10px)',
      border: `1px solid ${
        isEditing ? 'rgba(139, 92, 246, 0.5)' : 'rgba(139, 92, 246, 0.3)'
      }`,
      borderRadius: '12px',
      padding: '20px',
      transition: 'all 0.3s ease',
    }),
    beneficiaryHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '16px',
    },
    beneficiaryName: {
      fontSize: '16px',
      fontWeight: '600',
      color: '#e2e8f0',
    },
    beneficiaryPhone: {
      fontSize: '13px',
      color: '#64748b',
      marginTop: '4px',
    },
    editForm: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    },
    inputGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    },
    label: {
      fontSize: '12px',
      fontWeight: '600',
      color: '#06b6d4',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
    },
    inputWrapper: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
    },
    inputIcon: {
      position: 'absolute',
      left: '12px',
      fontSize: '16px',
      color: '#06b6d4',
      pointerEvents: 'none',
    },
    input: (fieldName) => ({
      width: '100%',
      padding: '10px 12px 10px 36px',
      background: 'rgba(30, 30, 40, 0.8)',
      border: `2px solid ${
        errors[fieldName] ? '#ef4444' : focusedField === fieldName ? '#06b6d4' : 'rgba(139, 92, 246, 0.2)'
      }`,
      borderRadius: '6px',
      color: '#e2e8f0',
      fontSize: '13px',
      fontFamily: 'Inter, sans-serif',
      outline: 'none',
      transition: 'all 0.3s ease',
      boxShadow:
        focusedField === fieldName
          ? `0 0 12px rgba(6, 182, 212, 0.4)`
          : errors[fieldName]
          ? `0 0 12px rgba(239, 68, 68, 0.4)`
          : 'none',
    }),
    errorText: {
      fontSize: '11px',
      color: '#ef4444',
      marginTop: '2px',
    },
    editActions: {
      display: 'flex',
      gap: '8px',
      marginTop: '12px',
    },
    actionButton: (type) => ({
      flex: 1,
      padding: '8px 12px',
      background:
        type === 'save'
          ? 'rgba(132, 204, 22, 0.2)'
          : 'rgba(100, 116, 139, 0.2)',
      border: `1px solid ${type === 'save' ? '#84cc16' : '#64748b'}`,
      borderRadius: '6px',
      color: type === 'save' ? '#84cc16' : '#64748b',
      fontSize: '12px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
    }),
    cardActions: {
      display: 'flex',
      gap: '8px',
    },
    iconButton: (type) => ({
      padding: '8px 12px',
      background: type === 'edit' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(239, 68, 68, 0.2)',
      border: `1px solid ${type === 'edit' ? '#8b5cf6' : '#ef4444'}`,
      borderRadius: '6px',
      color: type === 'edit' ? '#8b5cf6' : '#ef4444',
      fontSize: '12px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
    }),
    deleteConfirmDialog: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    },
    confirmCard: {
      background: 'rgba(18, 18, 26, 0.95)',
      border: '1px solid rgba(139, 92, 246, 0.3)',
      borderRadius: '12px',
      padding: '24px',
      maxWidth: '300px',
      textAlign: 'center',
    },
    confirmTitle: {
      fontSize: '16px',
      fontWeight: '600',
      color: '#e2e8f0',
      marginBottom: '12px',
    },
    confirmText: {
      fontSize: '13px',
      color: '#64748b',
      marginBottom: '20px',
      lineHeight: '1.5',
    },
    confirmActions: {
      display: 'flex',
      gap: '12px',
    },
    confirmButton: (type) => ({
      flex: 1,
      padding: '10px 16px',
      background: type === 'delete' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(100, 116, 139, 0.2)',
      border: `1px solid ${type === 'delete' ? '#ef4444' : '#64748b'}`,
      borderRadius: '6px',
      color: type === 'delete' ? '#ef4444' : '#64748b',
      fontSize: '13px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
    }),
    stickyBottom: {
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'linear-gradient(180deg, rgba(8, 8, 16, 0), rgba(8, 8, 16, 0.95))',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '12px',
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
      background: isSuccess
        ? 'linear-gradient(135deg, #8b5cf6, #06b6d4)'
        : '#84cc16',
      border: 'none',
      borderRadius: '8px',
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
      boxShadow: `0 0 20px ${
        isSuccess
          ? 'rgba(139, 92, 246, 0.4)'
          : 'rgba(132, 204, 22, 0.4)'
      }`,
      opacity: isLoading ? 0.7 : 1,
    },
    buttonIcon: {
      fontSize: '18px',
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
      padding: '12px',
      background: 'rgba(239, 68, 68, 0.1)',
      border: '1px solid rgba(239, 68, 68, 0.3)',
      borderRadius: '6px',
    },
    emptyState: {
      textAlign: 'center',
      padding: '40px 20px',
      color: '#64748b',
    },
    emptyIcon: {
      fontSize: '48px',
      marginBottom: '16px',
    },
    emptyText: {
      fontSize: '14px',
      marginBottom: '8px',
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
        <div style={styles.contentWrapper}>
          {/* Header */}
          <div style={styles.header}>
            <button
              onClick={onBack}
              style={styles.backButton}
              onMouseEnter={(e) => (e.target.style.color = '#8b5cf6')}
              onMouseLeave={(e) => (e.target.style.color = '#06b6d4')}
            >
              ←
            </button>
            <h1 style={styles.title}>Emergency Contacts</h1>
            <div style={styles.placeholder}></div>
          </div>

          <p style={styles.subtitle}>
            Manage your emergency contacts. They will be notified during an SOS alert.
          </p>

          {/* Beneficiaries List */}
          {beneficiaries.length > 0 ? (
            <div style={styles.beneficiariesContainer}>
              {(Array.isArray(beneficiaries) ? beneficiaries : []).map((beneficiary) => (
                <div
                  key={beneficiary.id}
                  style={styles.beneficiaryCard(editingId === beneficiary.id)}
                >
                  {editingId === beneficiary.id ? (
                    // Edit Mode
                    <div style={styles.editForm}>
                      <div style={styles.inputGroup}>
                        <label style={styles.label}>Name</label>
                        <div style={styles.inputWrapper}>
                          <span style={styles.inputIcon}>👤</span>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => {
                              setEditName(e.target.value);
                              if (errors.name) setErrors({ ...errors, name: '' });
                            }}
                            onFocus={() => setFocusedField('name')}
                            onBlur={() => setFocusedField(null)}
                            style={styles.input('name')}
                          />
                        </div>
                        {errors.name && <span style={styles.errorText}>{errors.name}</span>}
                      </div>

                      <div style={styles.inputGroup}>
                        <label style={styles.label}>Phone</label>
                        <div style={styles.inputWrapper}>
                          <span style={styles.inputIcon}>📱</span>
                          <input
                            type="tel"
                            value={editPhone}
                            onChange={(e) => {
                              setEditPhone(e.target.value);
                              if (errors.phone) setErrors({ ...errors, phone: '' });
                            }}
                            onFocus={() => setFocusedField('phone')}
                            onBlur={() => setFocusedField(null)}
                            style={styles.input('phone')}
                          />
                        </div>
                        {errors.phone && <span style={styles.errorText}>{errors.phone}</span>}
                      </div>

                      <div style={styles.editActions}>
                        <button
                          onClick={handleSaveEdit}
                          style={styles.actionButton('save')}
                          onMouseEnter={(e) => {
                            e.target.style.background = 'rgba(132, 204, 22, 0.3)';
                            e.target.style.boxShadow = '0 0 8px rgba(132, 204, 22, 0.4)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = 'rgba(132, 204, 22, 0.2)';
                            e.target.style.boxShadow = 'none';
                          }}
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          style={styles.actionButton('cancel')}
                          onMouseEnter={(e) => {
                            e.target.style.background = 'rgba(100, 116, 139, 0.3)';
                            e.target.style.boxShadow = '0 0 8px rgba(100, 116, 139, 0.4)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = 'rgba(100, 116, 139, 0.2)';
                            e.target.style.boxShadow = 'none';
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <>
                      <div style={styles.beneficiaryHeader}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            background: beneficiary.avatar_url ? `url(${beneficiary.avatar_url}) center/cover no-repeat` : 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            fontSize: 15,
                            fontWeight: 700,
                            flexShrink: 0,
                            boxShadow: '0 0 12px rgba(139,92,246,0.35)',
                            border: '1.5px solid rgba(139,92,246,0.5)',
                            overflow: 'hidden'
                          }}>
                            {!beneficiary.avatar_url && (beneficiary.name?.charAt(0)?.toUpperCase() || '👤')}
                          </div>
                          <div>
                            <div style={styles.beneficiaryName}>{beneficiary.name}</div>
                            <div style={styles.beneficiaryPhone}>{beneficiary.phone}</div>
                          </div>
                        </div>
                        <div style={styles.cardActions}>
                          <button
                            onClick={() => handleEdit(beneficiary.id)}
                            style={{ ...styles.iconButton('edit'), display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            onMouseEnter={(e) => {
                              e.target.style.background = 'rgba(139, 92, 246, 0.3)';
                              e.target.style.boxShadow = '0 0 8px rgba(139, 92, 246, 0.4)';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.background = 'rgba(139, 92, 246, 0.2)';
                              e.target.style.boxShadow = 'none';
                            }}
                          >
                            <Pencil size={12} />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(beneficiary.id)}
                            style={{ ...styles.iconButton('delete'), display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            onMouseEnter={(e) => {
                              e.target.style.background = 'rgba(239, 68, 68, 0.3)';
                              e.target.style.boxShadow = '0 0 8px rgba(239, 68, 68, 0.4)';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.background = 'rgba(239, 68, 68, 0.2)';
                              e.target.style.boxShadow = 'none';
                            }}
                          >
                            <Trash2 size={12} />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>
                <Users size={36} color="#64748b" />
              </div>
              <div style={styles.emptyText}>No emergency contacts yet</div>
              <div style={{ fontSize: '12px', color: '#475569' }}>
                Add a contact to get started
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Bottom Section */}
      <div style={styles.stickyBottom}>
        <div style={styles.stickyContent}>
          {errors.general && <div style={styles.generalError}>{errors.general}</div>}
          <button
            onClick={handleSaveAll}
            style={styles.button}
            disabled={isLoading}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = `0 8px 24px ${
                  isSuccess
                    ? 'rgba(139, 92, 246, 0.6)'
                    : 'rgba(132, 204, 22, 0.6)'
                }`;
              }
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = `0 0 20px ${
                isSuccess
                  ? 'rgba(139, 92, 246, 0.4)'
                  : 'rgba(132, 204, 22, 0.4)'
              }`;
            }}
          >
            {isLoading ? (
              <>
                <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
                <span>Saving...</span>
              </>
            ) : isSuccess ? (
              <>
                <Check size={16} />
                <span>Saved!</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>Save Changes</span>
              </>
            )}
          </button>
          <button
            onClick={onBack}
            style={{ ...styles.backLink, display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}
            onMouseEnter={(e) => (e.target.style.color = '#06b6d4')}
            onMouseLeave={(e) => (e.target.style.color = '#64748b')}
          >
            <ChevronLeft size={14} />
            <span>Back without saving</span>
          </button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div style={styles.deleteConfirmDialog} onClick={() => setShowDeleteConfirm(null)}>
          <div
            style={styles.confirmCard}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.confirmTitle}>Delete Contact?</div>
            <div style={styles.confirmText}>
              Are you sure you want to delete this emergency contact? This action cannot be undone.
            </div>
            <div style={styles.confirmActions}>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                style={styles.confirmButton('cancel')}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(100, 116, 139, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(100, 116, 139, 0.2)';
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                style={styles.confirmButton('delete')}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(239, 68, 68, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(239, 68, 68, 0.2)';
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

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

export default ManageBeneficiaries;