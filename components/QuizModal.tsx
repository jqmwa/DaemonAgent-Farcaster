'use client'

import { useState } from 'react'

interface Question {
  id: number
  text: string
  options: string[]
}

interface Survey {
  id: string
  title: string
  description: string
  questions: Question[]
}

interface QuizModalProps {
  isOpen: boolean
  onClose: () => void
  survey: Survey | null
  onComplete?: (answers: Record<number, string>) => void
}

export default function QuizModal({ isOpen, onClose, survey, onComplete }: QuizModalProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen || !survey) return null

  const currentQuestion = survey.questions[currentQuestionIndex]
  const isLastQuestion = currentQuestionIndex === survey.questions.length - 1
  const hasAnswer = answers[currentQuestion.id] !== undefined

  const handleAnswerSelect = (option: string) => {
    setAnswers({
      ...answers,
      [currentQuestion.id]: option
    })
  }

  const handleNext = () => {
    if (isLastQuestion) {
      handleSubmit()
    } else {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    }
  }

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      if (onComplete) {
        await onComplete(answers)
      }
      // Reset state
      setCurrentQuestionIndex(0)
      setAnswers({})
      setIsSubmitting(false)
      onClose()
    } catch (error) {
      console.error('[QuizModal] Error submitting quiz:', error)
      setIsSubmitting(false)
    }
  }

  const handleClose = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
    }
    setCurrentQuestionIndex(0)
    setAnswers({})
    onClose()
  }

  const progress = ((currentQuestionIndex + 1) / survey.questions.length) * 100

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(4px)',
        paddingTop: '100px',
        paddingBottom: '20px',
        paddingLeft: '12px',
        paddingRight: '12px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose()
        }
      }}
    >
      <div
        className="relative w-full max-w-lg flex flex-col"
        style={{
          background: 'linear-gradient(135deg, rgba(18, 18, 26, 0.98) 0%, rgba(12, 12, 18, 0.98) 100%)',
          borderRadius: '16px 8px 12px 6px',
          border: '2px solid rgba(120, 138, 255, 0.3)',
          boxShadow: '0 0 40px rgba(120, 138, 255, 0.2)',
          maxHeight: 'calc(100vh - 120px)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 p-3 border-b" style={{ background: 'rgba(18, 18, 26, 0.95)', borderColor: 'rgba(120, 138, 255, 0.2)' }}>
          <div className="flex items-center justify-between mb-2">
            <h2
              className="text-white font-bold flex-1 pr-3"
              style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: '9px',
                lineHeight: '1.3'
              }}
            >
              {survey.title}
            </h2>
            <button
              onClick={(e) => handleClose(e)}
              className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '32px',
                lineHeight: '1',
                padding: '4px',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '40px',
                minHeight: '40px'
              }}
            >
              ×
            </button>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #788AFF 0%, #7177FF 100%)'
              }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1 text-center" style={{ fontSize: '10px' }}>
            Question {currentQuestionIndex + 1} of {survey.questions.length}
          </p>
        </div>

        {/* Question Content */}
        <div className="flex-1 overflow-y-auto p-3" style={{ minHeight: 0 }}>
          <div className="mb-3">
            <h3
              className="text-white font-bold mb-2"
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '13px',
                lineHeight: '1.4'
              }}
            >
              {currentQuestion.text}
            </h3>
          </div>

          {/* Answer Options */}
          <div className="space-y-1.5">
            {currentQuestion.options.map((option, index) => {
              const isSelected = answers[currentQuestion.id] === option
              const borderRadiusStyles = [
                '12px 6px 10px 8px',
                '8px 12px 6px 10px',
                '10px 8px 12px 6px',
                '6px 10px 8px 12px'
              ]

              return (
                <button
                  key={index}
                  onClick={() => handleAnswerSelect(option)}
                  className="w-full text-left p-2.5 transition-all hover:scale-[1.01]"
                  style={{
                    background: isSelected
                      ? 'linear-gradient(135deg, rgba(120, 138, 255, 0.3) 0%, rgba(120, 138, 255, 0.15) 100%)'
                      : 'linear-gradient(135deg, rgba(120, 138, 255, 0.1) 0%, rgba(18, 18, 26, 0.9) 100%)',
                    borderRadius: borderRadiusStyles[index % borderRadiusStyles.length],
                    border: `2px solid ${isSelected ? 'rgba(120, 138, 255, 0.5)' : 'rgba(120, 138, 255, 0.2)'}`,
                    color: isSelected ? '#788AFF' : '#E0E0E0',
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center mt-0.5"
                      style={{
                        background: isSelected ? '#788AFF' : 'rgba(120, 138, 255, 0.2)',
                        border: `2px solid ${isSelected ? '#788AFF' : 'rgba(120, 138, 255, 0.3)'}`
                      }}
                    >
                      {isSelected && (
                        <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                          <path
                            d="M2 6L5 9L10 3"
                            stroke="white"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                    <span
                      className="flex-1"
                      style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: '11px',
                        lineHeight: '1.3'
                      }}
                    >
                      {option}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="flex-shrink-0 p-3 border-t" style={{ background: 'rgba(18, 18, 26, 0.95)', borderColor: 'rgba(120, 138, 255, 0.2)' }}>
          <div className="flex gap-2">
            <button
              onClick={handlePrevious}
              disabled={currentQuestionIndex === 0}
              className="flex-1 px-3 py-2 text-xs uppercase transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'rgba(113, 119, 255, 0.1)',
                borderRadius: '8px 4px 6px 10px',
                color: '#7177FF',
                border: '1px solid rgba(113, 119, 255, 0.3)',
                fontSize: '10px'
              }}
            >
              Previous
            </button>
            <button
              onClick={handleNext}
              disabled={!hasAnswer || isSubmitting}
              className="flex-1 px-3 py-2 text-xs uppercase transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, rgba(120, 138, 255, 0.2) 0%, rgba(120, 138, 255, 0.1) 100%)',
                borderRadius: '4px 8px 10px 6px',
                color: '#788AFF',
                border: '1px solid rgba(120, 138, 255, 0.3)',
                fontSize: '10px'
              }}
            >
              {isSubmitting ? 'Submitting...' : isLastQuestion ? 'Submit' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
