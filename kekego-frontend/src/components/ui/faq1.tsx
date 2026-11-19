import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

export interface Faq {
  question: string
  answer: string
}

const DEFAULT_FAQS: Faq[] = [
  {
    question: 'How is the fare set?',
    answer:
      'Straight-line distance between your two stops, at a fixed per-km rate with a floor and rounded to the nearest ₦50. The booking card and the fare board run the same function — what you see is what the group pays per seat.',
  },
  {
    question: 'Why four seats?',
    answer:
      'A keke leaves when all four seats fill. No half-full departures, no haggling at the park. Your group page shows each seat as it fills.',
  },
  {
    question: 'Who can ride or drive?',
    answer:
      'Riders are verified students. Drivers are students or campus operators whose identity and keke have been checked. Only the listed stops are served.',
  },
  {
    question: 'Where do I track my trip?',
    answer:
      'After joining, the group page records driver, seats and route. Share it from the Trips page. Anything off — wrong driver, wrong route — report it from your profile.',
  },
  {
    question: 'How do drivers get paid?',
    answer:
      'Each seat fare lands in the driver wallet per trip. The exact split is shown inside the driver app before you accept, and withdrawals go to a bank account on payout days.',
  },
]

interface FAQSectionProps {
  items?: Faq[]
  eyebrow?: string
  heading?: string
  subheading?: string
}

export default function FAQSection({
  items = DEFAULT_FAQS,
  eyebrow = 'FAQ',
  heading = 'Frequently Asked Questions',
  subheading = 'Answers to the most common questions about riding and driving the campus line.',
}: FAQSectionProps) {
  return (
    <section className="w-full">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mb-12 text-center">
          <p className="mb-3 text-sm font-semibold text-primary">{eyebrow}</p>
          <h2 className="mb-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">{heading}</h2>
          <p className="mx-auto max-w-xl text-muted-foreground">{subheading}</p>
        </div>

        <Accordion type="single" collapsible defaultValue="item-0">
          {items.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="text-left text-base font-medium">{faq.question}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
