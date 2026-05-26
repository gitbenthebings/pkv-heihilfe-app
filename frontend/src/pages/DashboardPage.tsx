import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import AufgabenDashboard from '../components/AufgabenDashboard'
import RechnungDetailSlider from '../components/RechnungDetailSlider'

export default function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const qc = useQueryClient()
  const navigate = useNavigate()

  const sliderRechnungId = searchParams.get('rechnung')

  const openSlider = (id: string) => {
    setSearchParams(p => { p.set('rechnung', id); return p })
  }

  const closeSlider = () => {
    setSearchParams(p => { p.delete('rechnung'); return p })
  }

  return (
    <>
      <AufgabenDashboard onOpenSlider={openSlider} />
      <RechnungDetailSlider
        rechnungId={sliderRechnungId}
        onClose={closeSlider}
        onUpdate={() => qc.invalidateQueries({ queryKey: ['rechnungen'] })}
        onKopieren={(r) => navigate('/rechnungen', { state: { kopieVon: r } })}
      />
    </>
  )
}
