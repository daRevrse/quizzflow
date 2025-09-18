import classNames from "classnames";

const LoadingSpinner = ({
  size = "md",
  color = "primary",
  className = "",
  text = null,
  inline = false,
}) => {
  const sizeClasses = {
    xs: "w-4 h-4",
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-12 h-12",
    xl: "w-16 h-16",
  };

  const colorClasses = {
    primary: "border-primary-600",
    secondary: "border-secondary-600",
    success: "border-success-600",
    warning: "border-warning-600",
    danger: "border-danger-600",
    gray: "border-gray-600",
  };

  const spinnerClasses = classNames(
    "loading-spinner border-2 border-gray-200 dark:border-gray-700",
    sizeClasses[size],
    colorClasses[color],
    className
  );

  if (inline) {
    return (
      <span className="inline-flex items-center gap-2">
        <div className={spinnerClasses} />
        {text && (
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {text}
          </span>
        )}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <div className={spinnerClasses} />
      {text && (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{text}</p>
      )}
    </div>
  );
};

export default LoadingSpinner;
