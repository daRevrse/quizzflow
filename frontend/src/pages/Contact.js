import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import {
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  PaperAirplaneIcon,
  ClockIcon,
  ChatBubbleLeftRightIcon,
} from "@heroicons/react/24/outline";
import LoadingSpinner from "../components/common/LoadingSpinner";

const Contact = () => {
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();

  const onSubmit = async (data) => {
    try {
      setLoading(true);

      // Simuler l'envoi (à remplacer par votre API)
      await new Promise((resolve) => setTimeout(resolve, 1500));

      console.log("Formulaire soumis:", data);

      toast.success(
        "Message envoyé avec succès ! Nous vous répondrons dans les plus brefs délais."
      );
      reset();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de l'envoi du message");
    } finally {
      setLoading(false);
    }
  };

  const contactInfo = [
    {
      icon: EnvelopeIcon,
      title: "Email",
      content: "contact@quizflow.com",
      link: "mailto:contact@quizflow.com",
    },
    {
      icon: PhoneIcon,
      title: "Téléphone",
      content: "+228 XX XX XX XX",
      link: "tel:+228XXXXXXXX",
    },
    {
      icon: MapPinIcon,
      title: "Adresse",
      content: "Lomé, Maritime, Togo",
      link: null,
    },
    {
      icon: ClockIcon,
      title: "Horaires",
      content: "Lun - Ven : 9h00 - 18h00",
      link: null,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Contactez-nous
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Une question ? Une suggestion ? N'hésitez pas à nous contacter.
            Notre équipe vous répondra dans les plus brefs délais.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Informations de contact */}
          <div className="lg:col-span-1 space-y-6">
            {/* Carte principale */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
                  <ChatBubbleLeftRightIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Informations
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Comment nous joindre
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {contactInfo.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-primary-50 dark:bg-primary-900/20 rounded-lg flex items-center justify-center">
                        <item.icon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {item.title}
                      </p>
                      {item.link ? (
                        <a
                          href={item.link}
                          className="text-sm text-primary-600 dark:text-primary-400 hover:underline break-all"
                        >
                          {item.content}
                        </a>
                      ) : (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {item.content}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Carte FAQ */}
            <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-6 border border-primary-200 dark:border-primary-800">
              <h3 className="text-lg font-semibold text-primary-900 dark:text-primary-200 mb-2">
                Besoin d'aide rapide ?
              </h3>
              <p className="text-sm text-primary-700 dark:text-primary-300 mb-4">
                Consultez notre page d'aide pour trouver des réponses aux
                questions fréquentes.
              </p>
              <a
                href="/help"
                className="inline-flex items-center text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
              >
                Accéder à l'aide
                <svg
                  className="ml-2 h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </a>
            </div>
          </div>

          {/* Formulaire de contact */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                Envoyez-nous un message
              </h2>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Nom et Email */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Nom complet <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      {...register("name", {
                        required: "Le nom est requis",
                        minLength: {
                          value: 2,
                          message: "Minimum 2 caractères",
                        },
                      })}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
                      placeholder="Jean Dupont"
                    />
                    {errors.name && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {errors.name.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      {...register("email", {
                        required: "L'email est requis",
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: "Email invalide",
                        },
                      })}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
                      placeholder="jean.dupont@example.com"
                    />
                    {errors.email && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {errors.email.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Téléphone et Sujet */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Téléphone (optionnel)
                    </label>
                    <input
                      type="tel"
                      {...register("phone")}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
                      placeholder="+228 XX XX XX XX"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Sujet <span className="text-red-500">*</span>
                    </label>
                    <select
                      {...register("subject", {
                        required: "Veuillez sélectionner un sujet",
                      })}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
                    >
                      <option value="">Sélectionnez un sujet</option>
                      <option value="question">Question générale</option>
                      <option value="support">Support technique</option>
                      <option value="feature">
                        Suggestion de fonctionnalité
                      </option>
                      <option value="bug">Signaler un bug</option>
                      <option value="partnership">Partenariat</option>
                      <option value="other">Autre</option>
                    </select>
                    {errors.subject && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {errors.subject.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Message <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    {...register("message", {
                      required: "Le message est requis",
                      minLength: {
                        value: 10,
                        message: "Minimum 10 caractères",
                      },
                    })}
                    rows={6}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors resize-none"
                    placeholder="Décrivez votre demande en détail..."
                  />
                  {errors.message && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {errors.message.message}
                    </p>
                  )}
                </div>

                {/* Acceptation RGPD */}
                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      type="checkbox"
                      {...register("consent", {
                        required:
                          "Vous devez accepter la politique de confidentialité",
                      })}
                      className="w-4 h-4 border border-gray-300 rounded text-primary-600 focus:ring-primary-500"
                    />
                  </div>
                  <div className="ml-3">
                    <label className="text-sm text-gray-600 dark:text-gray-400">
                      J'accepte que mes données soient utilisées pour traiter ma
                      demande.
                      <a
                        href="/privacy"
                        className="text-primary-600 dark:text-primary-400 hover:underline ml-1"
                      >
                        Politique de confidentialité
                      </a>
                    </label>
                    {errors.consent && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {errors.consent.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Bouton submit */}
                <div className="flex items-center justify-end space-x-4">
                  <button
                    type="button"
                    onClick={() => reset()}
                    className="px-6 py-3 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
                  >
                    Réinitialiser
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center px-8 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white font-semibold rounded-lg hover:from-primary-700 hover:to-primary-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg"
                  >
                    {loading ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        Envoi en cours...
                      </>
                    ) : (
                      <>
                        <PaperAirplaneIcon className="h-5 w-5 mr-2" />
                        Envoyer le message
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Section supplémentaire */}
        <div className="mt-12 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Vous préférez discuter en direct ?
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-2xl mx-auto">
              Notre équipe est disponible pour répondre à vos questions et vous
              accompagner dans l'utilisation de QuizFlow.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
              <a
                href="mailto:contact@quizflow.com"
                className="inline-flex items-center px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
              >
                <EnvelopeIcon className="h-5 w-5 mr-2" />
                Envoyer un email
              </a>
              <a
                href="tel:+228XXXXXXXX"
                className="inline-flex items-center px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                <PhoneIcon className="h-5 w-5 mr-2" />
                Appeler maintenant
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
