'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown, ArrowUp, Car, Check, ExternalLink, Loader2, RotateCcw, Save,
  Scissors, ShoppingBag, Sparkles, SprayCan, Star, Store, TriangleAlert, Utensils, Wrench,
} from 'lucide-react'
import { useFeedback } from '@/components/feedback-provider'
import { createClient } from '@/lib/supabase/client'
import { mutationErrorMessage, reportClientMutationError } from '@/lib/client-errors'
import type { Business, BusinessLink, BusinessPreferences } from '@/lib/types'
import {
  computeEnabledSections, industryDefaultSectionOrder, industryOptions, productsSectionTitleFor, resolvePrimaryAction,
  resolveSectionOrder, sectionMeta, type BusinessIndustry, type BusinessPrimaryAction, type PublicSectionKey,
} from '@/lib/section-order'
import { timezoneOptions } from '@/lib/timezones'

const industryIcons: Record<string, React.ComponentType<{ size?: number }>> = {
  ShoppingBag, Scissors, Sparkles, Car, Wrench, SprayCan, Utensils, Store,
}

type Availability = {
  hasOrdering: boolean
  hasBooking: boolean
  hasRequest: boolean
  hasAnnouncements: boolean
  hasProducts: boolean
  hasServices: boolean
  hasOffers: boolean
  hasGallery: boolean
  hasHours: boolean
  hasLeadForm: boolean
}

function isValidUrl(value: string): boolean {
  if (!value.trim()) return true
  try { const url = new URL(value.trim()); return url.protocol === 'http:' || url.protocol === 'https:' } catch { return false }
}

function orderEquals(a: PublicSectionKey[], b: PublicSectionKey[]) {
  return a.length === b.length && a.every((key, i) => key === b[i])
}

export default function PreferencesEditor({ business, initialPreferences, links, availability }: {
  business: Business
  initialPreferences: BusinessPreferences
  links: BusinessLink[]
  availability: Availability
}) {
  const notify = useFeedback()
  const supabase = createClient()
  const existingReviewLink = useMemo(() => links.find((l) => l.type === 'google_review'), [links])
  const secondaryLinksCount = useMemo(() => links.filter((l) => l.type !== 'google_review').length, [links])

  const [industry, setIndustry] = useState<BusinessIndustry>(initialPreferences.industry)
  const [primaryAction, setPrimaryAction] = useState<BusinessPrimaryAction>(initialPreferences.primary_action)
  const [timezone, setTimezone] = useState(initialPreferences.timezone)
  const [serviceArea, setServiceArea] = useState(initialPreferences.service_area || '')
  const [fulfillmentText, setFulfillmentText] = useState(initialPreferences.fulfillment_text || '')
  const [productsSectionTitle, setProductsSectionTitle] = useState(initialPreferences.products_section_title || '')
  const [showPublicHours, setShowPublicHours] = useState(initialPreferences.show_public_hours)
  const [showOpenStatus, setShowOpenStatus] = useState(initialPreferences.show_open_status)
  const [motionEnabled, setMotionEnabled] = useState(initialPreferences.motion_enabled)
  const [showCategoryFilters, setShowCategoryFilters] = useState(initialPreferences.show_category_filters)
  const [productLayout, setProductLayout] = useState(initialPreferences.product_layout)
  const [address, setAddress] = useState(business.address || '')
  const [reviewUrl, setReviewUrl] = useState(existingReviewLink?.url || '')
  const [sectionOrder, setSectionOrder] = useState<PublicSectionKey[]>(
    (initialPreferences.section_order.length ? initialPreferences.section_order : industryDefaultSectionOrder[initialPreferences.industry]) as PublicSectionKey[],
  )
  const [saving, setSaving] = useState(false)
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify({ industry, primaryAction, timezone, serviceArea, fulfillmentText, productsSectionTitle, showPublicHours, showOpenStatus, motionEnabled, showCategoryFilters, productLayout, address, reviewUrl, sectionOrder }))
  const prevIndustryRef = useRef(initialPreferences.industry)

  const enabledSections = useMemo(() => computeEnabledSections({
    hasAnnouncements: availability.hasAnnouncements,
    hasProducts: availability.hasProducts,
    hasOrdering: availability.hasOrdering,
    hasServices: availability.hasServices,
    hasOffers: availability.hasOffers,
    hasBooking: availability.hasBooking,
    hasRequest: availability.hasRequest,
    hasGallery: availability.hasGallery,
    hasHours: availability.hasHours && showPublicHours,
    hasReviewLink: reviewUrl.trim().length > 0,
    hasContactInfo: Boolean(address.trim() || business.phone || business.email || serviceArea.trim() || fulfillmentText.trim()),
    hasSecondaryLinks: secondaryLinksCount > 0,
    hasLeadForm: availability.hasLeadForm,
  }), [availability, showPublicHours, reviewUrl, address, business.phone, business.email, serviceArea, fulfillmentText, secondaryLinksCount])

  const visibleOrder = useMemo(() => resolveSectionOrder({ savedOrder: sectionOrder, industry, enabledSections }), [sectionOrder, industry, enabledSections])
  const hiddenSections = useMemo(() => (Object.keys(sectionMeta) as PublicSectionKey[]).filter((key) => !enabledSections.has(key)), [enabledSections])

  const currentSnapshot = JSON.stringify({ industry, primaryAction, timezone, serviceArea, fulfillmentText, productsSectionTitle, showPublicHours, showOpenStatus, motionEnabled, showCategoryFilters, productLayout, address, reviewUrl, sectionOrder })
  const dirty = currentSnapshot !== savedSnapshot

  useEffect(() => {
    if (!dirty) return
    function warn(event: BeforeUnloadEvent) { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function handleIndustryChange(next: BusinessIndustry) {
    const previous = prevIndustryRef.current
    const previousRecommended = resolveSectionOrder({ savedOrder: industryDefaultSectionOrder[previous], industry: previous, enabledSections })
    const nextRecommended = resolveSectionOrder({ savedOrder: industryDefaultSectionOrder[next], industry: next, enabledSections })
    const currentlyUnmodified = orderEquals(visibleOrder, previousRecommended)
    setIndustry(next)
    if (currentlyUnmodified) setSectionOrder(nextRecommended)
    prevIndustryRef.current = next
  }

  function resetLayout() {
    setSectionOrder(resolveSectionOrder({ savedOrder: industryDefaultSectionOrder[industry], industry, enabledSections }))
    notify('Layout reset to the recommended order for this business type.')
  }

  function move(key: PublicSectionKey, direction: -1 | 1) {
    setSectionOrder((current) => {
      const base = resolveSectionOrder({ savedOrder: current, industry, enabledSections })
      const index = base.indexOf(key)
      const swapWith = index + direction
      if (index < 0 || swapWith < 0 || swapWith >= base.length) return current
      const next = [...base]
      ;[next[index], next[swapWith]] = [next[swapWith], next[index]]
      return next
    })
  }

  const primaryActionOptions: Array<{ value: BusinessPrimaryAction; label: string; available: boolean }> = [
    { value: 'auto', label: 'Automatic (recommended)', available: true },
    { value: 'ordering', label: 'Order now', available: availability.hasOrdering },
    { value: 'booking', label: 'Book an appointment', available: availability.hasBooking },
    { value: 'request_service', label: 'Request service / get a quote', available: availability.hasRequest },
    { value: 'phone', label: 'Call now', available: Boolean(business.phone) },
    { value: 'none', label: 'No primary button', available: true },
  ]
  const selectedActionUnavailable = primaryAction !== 'auto' && primaryAction !== 'none' && !primaryActionOptions.find((o) => o.value === primaryAction)?.available
  const effectiveAction = resolvePrimaryAction({
    preferred: primaryAction, industry,
    hasOrdering: availability.hasOrdering, hasBooking: availability.hasBooking, hasRequest: availability.hasRequest, hasPhone: Boolean(business.phone),
  })
  const effectiveActionLabel = primaryActionOptions.find((o) => o.value === effectiveAction)?.label

  const reviewUrlError = !isValidUrl(reviewUrl) ? 'Enter a full link starting with https:// (e.g. your Google review link).' : null

  async function save() {
    if (reviewUrlError) { notify('Fix the review link before saving.', 'error'); return }
    setSaving(true)
    try {
      const finalOrder = resolveSectionOrder({ savedOrder: sectionOrder, industry, enabledSections })
      const { error: prefsError } = await supabase.from('business_preferences').upsert({
        business_id: business.id,
        industry,
        primary_action: primaryAction,
        section_order: finalOrder,
        timezone,
        service_area: serviceArea.trim() || null,
        fulfillment_text: fulfillmentText.trim() || null,
        products_section_title: productsSectionTitle.trim() || null,
        show_public_hours: showPublicHours,
        show_open_status: showOpenStatus,
        motion_enabled: motionEnabled,
        show_category_filters: showCategoryFilters,
        product_layout: productLayout,
      })
      if (prefsError) throw prefsError

      if (address.trim() !== (business.address || '')) {
        const { error: addressError } = await supabase.from('businesses').update({ address: address.trim() || null }).eq('id', business.id)
        if (addressError) throw addressError
      }

      const trimmedReviewUrl = reviewUrl.trim()
      if (existingReviewLink && !trimmedReviewUrl) {
        const { error: deleteError } = await supabase.from('business_links').delete().eq('id', existingReviewLink.id)
        if (deleteError) throw deleteError
      } else if (existingReviewLink && trimmedReviewUrl !== existingReviewLink.url) {
        const { error: updateError } = await supabase.from('business_links').update({ url: trimmedReviewUrl }).eq('id', existingReviewLink.id)
        if (updateError) throw updateError
      } else if (!existingReviewLink && trimmedReviewUrl) {
        const { error: insertError } = await supabase.from('business_links').insert({
          business_id: business.id, type: 'google_review', label: 'Leave a Google review', url: trimmedReviewUrl,
          icon: 'google_review', display_order: 999, enabled: true,
        })
        if (insertError) throw insertError
      }

      setSavedSnapshot(currentSnapshot)
      notify('Page settings saved.')
    } catch (error) {
      reportClientMutationError('save page settings', error)
      notify(mutationErrorMessage('save your page settings', error), 'error')
    }
    finally { setSaving(false) }
  }

  return <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
    <div className="grid gap-6">

      <section className="rounded-2xl border border-[#deded7] bg-white p-5 sm:p-6">
        <h2 className="font-semibold">Business type</h2>
        <p className="mt-1 text-xs text-[#77776f]">This sets a smart starting point for your page — it never deletes or hides anything you've already added.</p>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {industryOptions.map((option) => {
            const Icon = industryIcons[option.icon] || Store
            const isActive = industry === option.value
            return <button key={option.value} type="button" onClick={() => handleIndustryChange(option.value)}
              className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition ${isActive ? 'border-[#8b6b3d] bg-[#faf6ee]' : 'border-[#e4e2d8] hover:border-[#d8d6ce]'}`}>
              <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${isActive ? 'bg-[#8b6b3d] text-white' : 'bg-[#f2f1ea] text-[#77776f]'}`}><Icon size={16}/></span>
              <span><span className="block text-sm font-semibold">{option.label}</span><span className="mt-0.5 block text-xs text-[#77776f]">{option.description}</span></span>
            </button>
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-[#deded7] bg-white p-5 sm:p-6">
        <h2 className="font-semibold">What should customers do first?</h2>
        <p className="mt-1 text-xs text-[#77776f]">This becomes the big button at the top of your page.</p>
        {selectedActionUnavailable && <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#fdf3e7] p-3 text-xs text-[#8b5f22]"><TriangleAlert size={15} className="mt-0.5 shrink-0"/><span>That action isn't turned on right now, so customers will see <strong>{effectiveActionLabel || 'no button'}</strong> instead. Pick a different one, or turn the feature back on from Catalog.</span></div>}
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {primaryActionOptions.filter((o) => o.available || o.value === primaryAction).map((option) => <button key={option.value} type="button" disabled={!option.available} onClick={() => setPrimaryAction(option.value)}
            className={`rounded-xl border px-3.5 py-3 text-left text-sm font-medium transition ${primaryAction === option.value ? 'border-[#8b6b3d] bg-[#faf6ee]' : 'border-[#e4e2d8] hover:border-[#d8d6ce]'} ${!option.available ? 'opacity-50' : ''}`}>{option.label}{!option.available && <span className="block text-[10px] font-normal text-[#9a988f]">Not available yet</span>}</button>)}
        </div>
      </section>

      <section className="rounded-2xl border border-[#deded7] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="font-semibold">Page layout</h2><p className="mt-1 text-xs text-[#77776f]">Reorder the sections customers scroll through. Only sections with something to show appear here.</p></div>
          <button type="button" onClick={resetLayout} className="dashboard-secondary inline-flex items-center gap-1.5 text-xs"><RotateCcw size={13}/> Reset to recommended</button>
        </div>
        <ol className="mt-4 grid gap-2">
          {visibleOrder.map((key, index) => <li key={key} className="flex items-center gap-3 rounded-xl border border-[#e4e2d8] bg-[#fafaf7] p-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold text-[#77776f]">{index + 1}</span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{sectionMeta[key].label}</span><span className="block text-xs text-[#77776f]">{sectionMeta[key].description}</span></span>
            <span className="flex shrink-0 gap-1">
              <button type="button" aria-label={`Move ${sectionMeta[key].label} up`} disabled={index === 0} onClick={() => move(key, -1)} className="icon-button disabled:opacity-30"><ArrowUp size={14}/></button>
              <button type="button" aria-label={`Move ${sectionMeta[key].label} down`} disabled={index === visibleOrder.length - 1} onClick={() => move(key, 1)} className="icon-button disabled:opacity-30"><ArrowDown size={14}/></button>
            </span>
          </li>)}
          {!visibleOrder.length && <li className="rounded-xl border border-dashed border-[#d8d6ce] p-4 text-center text-xs text-[#9a988f]">Nothing to show yet — add products, services, or turn on a feature in Catalog.</li>}
        </ol>
        {enabledSections.has('products') && <label className="mt-4 grid gap-1.5 text-[11px] font-semibold uppercase tracking-[.08em] text-[#77776f]">
          <span>Products/showcase section title</span>
          <input className="form-control" maxLength={60} placeholder={productsSectionTitleFor(industry)} value={productsSectionTitle} onChange={(event) => setProductsSectionTitle(event.target.value)}/>
          <span className="text-[10px] font-normal normal-case text-[#9a988f]">Leave blank to use the default for your business type: "{productsSectionTitleFor(industry)}"</span>
        </label>}
        {hiddenSections.length > 0 && <div className="mt-4 border-t border-[#eee9df] pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#9a988f]">Not shown yet</p>
          <div className="mt-2 grid gap-1.5">{hiddenSections.map((key) => <div key={key} className="flex items-center justify-between rounded-lg bg-[#f6f6f3] px-3 py-2 text-xs text-[#9a988f]"><span>{sectionMeta[key].label}</span><span>{sectionMeta[key].description}</span></div>)}</div>
        </div>}
      </section>

      <section className="rounded-2xl border border-[#deded7] bg-white p-5 sm:p-6">
        <h2 className="font-semibold">Hours &amp; timezone</h2>
        <p className="mt-1 text-xs text-[#77776f]">Used to show an accurate "Open now" / "Closed" status on your page. Set your hours themselves on the Catalog page.</p>
        <label className="mt-4 grid gap-1.5 text-[11px] font-semibold uppercase tracking-[.08em] text-[#77776f]"><span>Timezone</span>
          <select className="form-control" value={timezone} onChange={(event) => setTimezone(event.target.value)}>
            {!timezoneOptions.some((tz) => tz.value === timezone) && <option value={timezone}>{timezone}</option>}
            {timezoneOptions.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
          </select>
        </label>
        <div className="mt-4 grid gap-2 rounded-xl border border-[#e4e2d8] bg-[#fafaf7] p-4">
          <label className="flex items-center justify-between gap-4 text-sm font-medium"><span>Show business hours publicly</span><input type="checkbox" checked={showPublicHours} onChange={(event) => setShowPublicHours(event.target.checked)} /></label>
          <label className="flex items-center justify-between gap-4 text-sm font-medium"><span>Show open / closed status</span><input type="checkbox" checked={showOpenStatus} onChange={(event) => setShowOpenStatus(event.target.checked)} /></label>
          <p className="text-xs text-[#77776f]">The live status uses this timezone. You can hide either signal without deleting the saved schedule.</p>
        </div>
      </section>

      <section className="rounded-2xl border border-[#deded7] bg-white p-5 sm:p-6">
        <h2 className="font-semibold">Page experience</h2>
        <p className="mt-1 text-xs text-[#77776f]">Controls how your public page looks and behaves. New defaults match how your page already looks, so nothing changes until you adjust one.</p>
        <div className="mt-4 grid gap-2 rounded-xl border border-[#e4e2d8] bg-[#fafaf7] p-4">
          <label className="flex items-center justify-between gap-4 text-sm font-medium"><span>Subtle animations</span><input type="checkbox" checked={motionEnabled} onChange={(event) => setMotionEnabled(event.target.checked)} /></label>
          <label className="flex items-center justify-between gap-4 text-sm font-medium"><span>Show product category filters</span><input type="checkbox" checked={showCategoryFilters} onChange={(event) => setShowCategoryFilters(event.target.checked)} /></label>
          <p className="text-xs text-[#77776f]">Animations control scroll-in effects and UI transitions on your page. Category filters only show up automatically when your products use more than one category.</p>
        </div>
        <label className="mt-4 grid gap-1.5 text-[11px] font-semibold uppercase tracking-[.08em] text-[#77776f]"><span>Product layout</span>
          <select className="form-control" value={productLayout} onChange={(event) => setProductLayout(event.target.value as BusinessPreferences['product_layout'])}>
            <option value="auto">Auto (recommended)</option>
            <option value="cards">Cards</option>
            <option value="list">List</option>
          </select>
        </label>
        <p className="mt-1.5 text-xs text-[#77776f]">Auto uses a responsive card grid that adapts to screen size. List keeps the compact row layout.</p>
      </section>

      <section className="rounded-2xl border border-[#deded7] bg-white p-5 sm:p-6">
        <h2 className="font-semibold flex items-center gap-1.5"><Star size={15} className="text-[#8b6b3d]"/> Customer reviews</h2>
        <p className="mt-1 text-xs text-[#77776f]">This button will appear on your Quicklink page so customers can leave a review. We never show fake ratings or stars.</p>
        <label className="mt-4 grid gap-1.5 text-[11px] font-semibold uppercase tracking-[.08em] text-[#77776f]"><span>Google review link</span>
          <input className="form-control" placeholder="https://g.page/r/your-business/review" value={reviewUrl} onChange={(event) => setReviewUrl(event.target.value)}/>
        </label>
        {reviewUrlError && <p className="mt-1.5 text-xs text-[#b13b3b]">{reviewUrlError}</p>}
      </section>

      <section className="rounded-2xl border border-[#deded7] bg-white p-5 sm:p-6">
        <h2 className="font-semibold">Location &amp; service area</h2>
        <p className="mt-1 text-xs text-[#77776f]">Leave the address blank if you don't want your exact address shown publicly — a service area description still lets customers know where you work.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-[11px] font-semibold uppercase tracking-[.08em] text-[#77776f]"><span>Business address (public)</span><input className="form-control" placeholder="Leave blank to hide" value={address} onChange={(event) => setAddress(event.target.value)}/></label>
          <label className="grid gap-1.5 text-[11px] font-semibold uppercase tracking-[.08em] text-[#77776f]"><span>Service area</span><input className="form-control" placeholder="e.g. Greater Boston area" value={serviceArea} onChange={(event) => setServiceArea(event.target.value)}/></label>
        </div>
        <label className="mt-4 grid gap-1.5 text-[11px] font-semibold uppercase tracking-[.08em] text-[#77776f]"><span>Fulfillment note (optional)</span><textarea className="form-control" rows={2} placeholder="e.g. Pickup only, no delivery. Or: We come to you." value={fulfillmentText} onChange={(event) => setFulfillmentText(event.target.value)}/></label>
      </section>

      <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-2xl border border-[#deded7] bg-white/95 p-4 shadow-lg backdrop-blur md:static md:shadow-none">
        <span className="text-xs text-[#77776f]">{dirty ? 'You have unsaved changes.' : 'All changes saved.'}</span>
        <button type="button" disabled={saving || !dirty} onClick={save} className="dashboard-primary inline-flex items-center gap-2 disabled:opacity-50">{saving ? <Loader2 size={15} className="animate-spin"/> : dirty ? <Save size={15}/> : <Check size={15}/>} {saving ? 'Saving…' : 'Save changes'}</button>
      </div>
    </div>

    <aside className="grid gap-4 self-start lg:sticky lg:top-6">
      <div className="rounded-2xl border border-[#deded7] bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#77776f]">Preview</p>
        <div className="mt-3 rounded-xl border border-[#eee9df] bg-[#fafaf7] p-4">
          <p className="text-sm font-semibold">{business.name}</p>
          <p className="mt-0.5 text-xs text-[#77776f]">{industryOptions.find((o) => o.value === industry)?.label}</p>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[.08em] text-[#9a988f]">Primary button</p>
          <p className="text-sm">{effectiveActionLabel || 'No button shown'}</p>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[.08em] text-[#9a988f]">Page order</p>
          <ol className="mt-1 grid gap-0.5 text-xs text-[#77776f]">{visibleOrder.map((key, i) => <li key={key}>{i + 1}. {sectionMeta[key].label}</li>)}</ol>
        </div>
        <a href={`/${business.slug}`} target="_blank" rel="noreferrer" className="dashboard-secondary mt-4 inline-flex w-full items-center justify-center gap-2 text-sm">Preview my page <ExternalLink size={14}/></a>
      </div>
    </aside>
  </div>
}
