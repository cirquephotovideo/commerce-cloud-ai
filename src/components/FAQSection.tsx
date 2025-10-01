import { useTranslation } from "react-i18next";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const FAQSection = () => {
  const { t } = useTranslation();

  const faqs = ["q1", "q2", "q3", "q4", "q5", "q6"];

  return (
    <section className="py-24 px-4 bg-card/30">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
            {t("faq.title")}
          </h2>
          <p className="text-xl text-muted-foreground">
            {t("faq.subtitle")}
          </p>
        </div>

        <Accordion type="single" collapsible className="w-full space-y-4">
          {faqs.map((faq, index) => (
            <AccordionItem
              key={faq}
              value={faq}
              className="border border-border rounded-lg px-6 bg-card/50 backdrop-blur-sm animate-fade-in"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <AccordionTrigger className="text-left hover:text-primary transition-colors">
                <span className="font-semibold">
                  {t(`faq.questions.${faq}.question`)}
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {t(`faq.questions.${faq}.answer`)}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};
