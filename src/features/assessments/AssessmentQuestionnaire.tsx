import {
  assessmentDomainLabels,
  assessmentOptions,
  type AssessmentInstrument,
  type AssessmentResponseMap,
} from './questions'

export function AssessmentQuestionnaire({
  instrument,
  responses,
  onChange,
  readOnly = false,
}: {
  instrument: AssessmentInstrument
  responses: AssessmentResponseMap
  onChange?: (responses: AssessmentResponseMap) => void
  readOnly?: boolean
}) {
  let previousDomain = ''
  return <div className="space-y-4">
    {instrument.questions.map((question, index) => {
      const showDomain = question.domain !== previousDomain
      previousDomain = question.domain
      const selected = responses[question.id]
      return <div key={question.id} className="space-y-3">
        {showDomain && <h2 className="px-1 pt-3 text-lg font-black text-[#171717]">Área {assessmentDomainLabels[question.domain].toLowerCase()}</h2>}
        <fieldset className="rounded-2xl border border-[#E9E7E7] bg-white p-5" disabled={readOnly}>
          <legend className="sr-only">Pregunta {index + 1}</legend>
          <p className="text-sm font-black leading-6 text-[#2F2F2F]"><span className="mr-2 text-[#A36B00]">{index + 1}.</span>{question.text}</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {assessmentOptions.map((option) => <label key={option.value} className={`rounded-2xl border p-3 text-center text-xs font-bold transition ${selected === option.value ? 'border-[#E49A02] bg-[#FFF7E8] text-[#7A5100]' : 'border-[#E9E7E7] text-[#747474]'} ${readOnly ? 'cursor-default' : 'cursor-pointer hover:border-[#E8CE99]'}`}>
              <input
                type="radio"
                className="sr-only"
                name={`assessment-${question.id}`}
                value={option.value}
                checked={selected === option.value}
                onChange={() => onChange?.({ ...responses, [question.id]: option.value })}
              />
              <span className="block text-sm font-black">{option.label}</span>
              {!readOnly && <span className="mt-1 block text-[10px] font-normal">{option.value} puntos</span>}
            </label>)}
          </div>
        </fieldset>
      </div>
    })}
  </div>
}
