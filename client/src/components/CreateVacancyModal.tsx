import { useState } from 'react'
import { X, Plus, Home, Car, Globe as GlobeIcon, Plane, Utensils, Briefcase, Shield, GraduationCap, CreditCard, Trophy } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/auth'
import type { Vacancy, VacancyInsert } from '../lib/database.types'
import Button from './Button'

interface CreateVacancyModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  editingVacancy?: Vacancy | null
}

const BENEFIT_OPTIONS = [
  { id: 'housing', label: 'Housing', icon: Home },
  { id: 'car', label: 'Car', icon: Car },
  { id: 'visa', label: 'Visa', icon: GlobeIcon },
  { id: 'flights', label: 'Flights', icon: Plane },
  { id: 'meals', label: 'Meals', icon: Utensils },
  { id: 'job', label: 'Job', icon: Briefcase },
  { id: 'insurance', label: 'Insurance', icon: Shield },
  { id: 'education', label: 'Education', icon: GraduationCap },
  { id: 'bonuses', label: 'Bonuses', icon: CreditCard },
  { id: 'equipment', label: 'Equipment', icon: Trophy },
]

export default function CreateVacancyModal({ isOpen, onClose, onSuccess, editingVacancy }: CreateVacancyModalProps) {
  const { user } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [formData, setFormData] = useState<Partial<VacancyInsert>>({
    opportunity_type: editingVacancy?.opportunity_type || 'player',
    title: editingVacancy?.title || '',
    position: editingVacancy?.position || undefined,
    gender: editingVacancy?.gender || undefined,
    description: editingVacancy?.description || '',
    location_city: editingVacancy?.location_city || '',
    location_country: editingVacancy?.location_country || '',
    start_date: editingVacancy?.start_date || null,
    duration_text: editingVacancy?.duration_text || '',
    requirements: editingVacancy?.requirements || [],
    benefits: editingVacancy?.benefits || [],
    custom_benefits: editingVacancy?.custom_benefits || [],
    priority: editingVacancy?.priority || 'medium',
    status: editingVacancy?.status || 'draft',
    application_deadline: editingVacancy?.application_deadline || null,
    contact_email: editingVacancy?.contact_email || '',
    contact_phone: editingVacancy?.contact_phone || '',
  })

  const [newRequirement, setNewRequirement] = useState('')
  const [newCustomBenefit, setNewCustomBenefit] = useState('')

  if (!isOpen) return null

  const handleInputChange = (field: keyof VacancyInsert, value: VacancyInsert[typeof field]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error for this field
    if (errors[field]) {
      const newErrors = { ...errors }
      delete newErrors[field]
      setErrors(newErrors)
    }
  }

  const toggleBenefit = (benefitId: string) => {
    const currentBenefits = formData.benefits || []
    const newBenefits = currentBenefits.includes(benefitId)
      ? currentBenefits.filter(b => b !== benefitId)
      : [...currentBenefits, benefitId]
    handleInputChange('benefits', newBenefits)
  }

  const addRequirement = () => {
    if (newRequirement.trim()) {
      handleInputChange('requirements', [...(formData.requirements || []), newRequirement.trim()])
      setNewRequirement('')
    }
  }

  const removeRequirement = (index: number) => {
    handleInputChange('requirements', (formData.requirements || []).filter((_, i) => i !== index))
  }

  const addCustomBenefit = () => {
    if (newCustomBenefit.trim()) {
      handleInputChange('custom_benefits', [...(formData.custom_benefits || []), newCustomBenefit.trim()])
      setNewCustomBenefit('')
    }
  }

  const removeCustomBenefit = (index: number) => {
    handleInputChange('custom_benefits', (formData.custom_benefits || []).filter((_, i) => i !== index))
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.title?.trim()) newErrors.title = 'Title is required'
    if (!formData.position) newErrors.position = 'Position is required'
    if (!formData.gender) newErrors.gender = 'Gender is required'
    if (!formData.location_city?.trim()) newErrors.location_city = 'City is required'
    if (!formData.location_country?.trim()) newErrors.location_country = 'Country is required'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!user || !validate()) return

    setIsLoading(true)
    try {
      const vacancyData: VacancyInsert = {
        club_id: user.id,
        opportunity_type: formData.opportunity_type || 'player',
        title: formData.title!,
        position: formData.position!,
        gender: formData.gender!,
        description: formData.description || null,
        location_city: formData.location_city!,
        location_country: formData.location_country!,
        start_date: formData.start_date || null,
        duration_text: formData.duration_text || null,
        requirements: formData.requirements || [],
        benefits: formData.benefits || [],
        custom_benefits: formData.custom_benefits || [],
        priority: formData.priority || 'medium',
        status: formData.status || 'draft',
        application_deadline: formData.application_deadline || null,
        contact_email: formData.contact_email || null,
        contact_phone: formData.contact_phone || null,
      }

      if (editingVacancy) {
        // Update existing vacancy
        const { error } = await supabase
          .from('vacancies')
          .update(vacancyData as never)
          .eq('id', editingVacancy.id)

        if (error) throw error
      } else {
        // Create new vacancy
        const { error } = await supabase
          .from('vacancies')
          .insert(vacancyData as never)

        if (error) throw error
      }

      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error saving vacancy:', error)
      alert('Failed to save vacancy. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const benefitsCount = (formData.benefits || []).length
  const benefitsPercentage = Math.round((benefitsCount / BENEFIT_OPTIONS.length) * 100)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-gray-700" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {editingVacancy ? 'Edit Opportunity' : 'Create New Opportunity'}
              </h2>
              <p className="text-sm text-gray-600">
                {editingVacancy ? 'Update your opportunity details' : `Create a new ${formData.opportunity_type} opportunity for your club`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic Information */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Briefcase className="w-5 h-5 text-gray-700" />
              <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Opportunity Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Opportunity Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.opportunity_type}
                    onChange={(e) => handleInputChange('opportunity_type', e.target.value as 'player' | 'coach')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#10b981] focus:border-transparent bg-white"
                    title="Opportunity type"
                  >
                    <option value="player">Player Position</option>
                    <option value="coach">Coach Position</option>
                  </select>
                </div>

                {/* Priority Level */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority Level
                  </label>
                  <select
                    value={formData.priority || ''}
                    onChange={(e) => handleInputChange('priority', e.target.value as 'low' | 'medium' | 'high')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#10b981] focus:border-transparent bg-white"
                    title="Priority level"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              {/* Opportunity Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Opportunity Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#10b981] focus:border-transparent ${
                    errors.title ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="e.g., Elite Youth Player Opportunity"
                />
                {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Position */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Position <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.position || ''}
                    onChange={(e) => handleInputChange('position', e.target.value as 'goalkeeper' | 'defender' | 'midfielder' | 'forward')}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#10b981] focus:border-transparent bg-white ${
                      errors.position ? 'border-red-500' : 'border-gray-300'
                    }`}
                    title="Position"
                  >
                    <option value="">Select position</option>
                    <option value="goalkeeper">Goalkeeper</option>
                    <option value="defender">Defender</option>
                    <option value="midfielder">Midfielder</option>
                    <option value="forward">Forward</option>
                  </select>
                  {errors.position && <p className="mt-1 text-sm text-red-600">{errors.position}</p>}
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Gender <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.gender || ''}
                    onChange={(e) => handleInputChange('gender', e.target.value as 'Men' | 'Women')}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#10b981] focus:border-transparent bg-white ${
                      errors.gender ? 'border-red-500' : 'border-gray-300'
                    }`}
                    title="Gender"
                  >
                    <option value="">Select gender</option>
                    <option value="Men">Men</option>
                    <option value="Women">Women</option>
                  </select>
                  {errors.gender && <p className="mt-1 text-sm text-red-600">{errors.gender}</p>}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#10b981] focus:border-transparent resize-none"
                  placeholder="Provide a detailed description of the opportunity..."
                />
              </div>
            </div>
          </section>

          {/* Location & Timeline */}
          <section className="border-t border-gray-200 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <GlobeIcon className="w-5 h-5 text-gray-700" />
              <h3 className="text-lg font-semibold text-gray-900">Location & Timeline</h3>
            </div>

            <div className="space-y-4">
              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    value={formData.location_city}
                    onChange={(e) => handleInputChange('location_city', e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#10b981] focus:border-transparent ${
                      errors.location_city ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="City"
                  />
                  <input
                    type="text"
                    value={formData.location_country}
                    onChange={(e) => handleInputChange('location_country', e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#10b981] focus:border-transparent ${
                      errors.location_country ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Country"
                  />
                </div>
                {(errors.location_city || errors.location_country) && (
                  <p className="mt-1 text-sm text-red-600">Both city and country are required</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Start Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={formData.start_date || ''}
                    onChange={(e) => handleInputChange('start_date', e.target.value || null)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#10b981] focus:border-transparent"
                  />
                </div>

                {/* Duration */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration
                  </label>
                  <input
                    type="text"
                    value={formData.duration_text || ''}
                    onChange={(e) => handleInputChange('duration_text', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#10b981] focus:border-transparent"
                    placeholder="e.g., 12 months"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Requirements */}
          <section className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Requirements</h3>
            
            <div className="space-y-3">
              {(formData.requirements || []).map((req, index) => (
                <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <span className="flex-1 text-sm text-gray-700">{req}</span>
                  <button
                    onClick={() => removeRequirement(index)}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    aria-label="Remove requirement"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              
              {(!formData.requirements || formData.requirements.length === 0) && (
                <p className="text-sm text-gray-500 italic py-2">e.g., Minimum 3 years competitive experience</p>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newRequirement}
                  onChange={(e) => setNewRequirement(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addRequirement()}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#10b981] focus:border-transparent"
                  placeholder="Add a requirement..."
                />
                <button
                  onClick={addRequirement}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Requirement
                </button>
              </div>
            </div>
          </section>

          {/* Benefits Package */}
          <section className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Benefits Package</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
              {BENEFIT_OPTIONS.map((benefit) => {
                const Icon = benefit.icon
                const isSelected = (formData.benefits || []).includes(benefit.id)
                
                return (
                  <button
                    key={benefit.id}
                    onClick={() => toggleBenefit(benefit.id)}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'border-[#10b981] bg-green-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 ${
                      isSelected ? 'bg-[#10b981]' : 'bg-gray-200'
                    }`}>
                      <Icon className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-gray-500'}`} />
                    </div>
                    <p className="text-sm font-medium text-gray-900 text-center">{benefit.label}</p>
                    <p className={`text-xs mt-1 text-center ${
                      isSelected ? 'text-green-600' : 'text-gray-500'
                    }`}>
                      {isSelected ? '✓ Included' : '✗ Not included'}
                    </p>
                  </button>
                )
              })}
            </div>

            {/* Benefits Summary */}
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  • {benefitsCount} benefits included
                </span>
                <span className="text-sm font-medium text-gray-700">{benefitsPercentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-[#10b981] h-2 rounded-full transition-all"
                  style={{ width: `${benefitsPercentage}%` }}
                />
              </div>
            </div>
          </section>

          {/* Additional Custom Benefits */}
          <section className="border-t border-gray-200 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">💡</span>
              <h3 className="text-lg font-semibold text-gray-900">Additional Custom Benefits</h3>
            </div>
            
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {(formData.custom_benefits || []).map((benefit, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm"
                  >
                    {benefit}
                    <button
                      onClick={() => removeCustomBenefit(index)}
                      className="hover:text-purple-900"
                      aria-label="Remove benefit"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCustomBenefit}
                  onChange={(e) => setNewCustomBenefit(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addCustomBenefit()}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#10b981] focus:border-transparent"
                  placeholder="e.g., Professional coaching and skill development"
                />
                <button
                  onClick={addCustomBenefit}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Custom Benefit
                </button>
              </div>
            </div>
          </section>

          {/* Application Details */}
          <section className="border-t border-gray-200 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">📅</span>
              <h3 className="text-lg font-semibold text-gray-900">Application Details</h3>
            </div>

            <div className="space-y-4">
              {/* Application Deadline */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Application Deadline
                </label>
                <input
                  type="date"
                  value={formData.application_deadline || ''}
                  onChange={(e) => handleInputChange('application_deadline', e.target.value || null)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#10b981] focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Contact Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    value={formData.contact_email || ''}
                    onChange={(e) => handleInputChange('contact_email', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#10b981] focus:border-transparent"
                    placeholder="info@elitehockeyacademy.com"
                  />
                </div>

                {/* Contact Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.contact_phone || ''}
                    onChange={(e) => handleInputChange('contact_phone', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#10b981] focus:border-transparent"
                    placeholder="+31 20 123 4567"
                  />
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
          >
            Cancel
          </button>
          <Button
            onClick={handleSave}
            disabled={isLoading}
            className="flex items-center gap-2 bg-[#10b981] hover:bg-[#059669]"
          >
            {isLoading ? 'Saving...' : editingVacancy ? 'Update Opportunity' : 'Create Opportunity'}
          </Button>
        </div>
      </div>
    </div>
  )
}
