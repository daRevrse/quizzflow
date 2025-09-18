const { DataTypes } = require("sequelize");
const bcrypt = require("bcryptjs");
const { sequelize } = require("../config/database");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        len: [3, 50],
        notEmpty: true,
      },
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
        notEmpty: true,
      },
      set(value) {
        this.setDataValue("email", value.toLowerCase().trim());
      },
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        len: [6, 255],
        notEmpty: true,
      },
    },
    role: {
      type: DataTypes.ENUM("formateur", "etudiant", "admin"),
      defaultValue: "formateur",
      allowNull: false,
    },
    firstName: {
      type: DataTypes.STRING(50),
      allowNull: true,
      validate: {
        len: [0, 50],
      },
    },
    lastName: {
      type: DataTypes.STRING(50),
      allowNull: true,
      validate: {
        len: [0, 50],
      },
    },
    avatar: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    preferences: {
      type: DataTypes.JSON,
      defaultValue: {
        theme: "light",
        language: "fr",
        notifications: true,
      },
      validate: {
        isValidPreferences(value) {
          if (value && typeof value === "object") {
            const { theme, language } = value;
            if (theme && !["light", "dark"].includes(theme)) {
              throw new Error("Theme invalide");
            }
            if (language && !["fr", "en"].includes(language)) {
              throw new Error("Langue invalide");
            }
          }
        },
      },
    },
  },
  {
    tableName: "users",
    indexes: [
      {
        unique: true,
        fields: ["email"],
      },
      {
        unique: true,
        fields: ["username"],
      },
      {
        fields: ["role"],
      },
      {
        fields: ["isActive"],
      },
    ],
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          const salt = await bcrypt.genSalt(12);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed("password")) {
          const salt = await bcrypt.genSalt(12);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
    },
  }
);

// Méthodes d'instance
User.prototype.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

User.prototype.toPublicJSON = function () {
  const values = { ...this.get() };
  delete values.password;
  return {
    id: values.id,
    username: values.username,
    email: values.email,
    role: values.role,
    firstName: values.firstName,
    lastName: values.lastName,
    avatar: values.avatar,
    preferences: values.preferences,
    createdAt: values.createdAt,
    lastLogin: values.lastLogin,
  };
};

User.prototype.updateLastLogin = function () {
  return this.update({ lastLogin: new Date() });
};

// Méthodes statiques/de classe
User.findByEmailOrUsername = function (identifier) {
  return this.findOne({
    where: {
      [sequelize.Sequelize.Op.or]: [
        { email: identifier.toLowerCase().trim() },
        { username: identifier.trim() },
      ],
    },
  });
};

User.findActiveUsers = function (options = {}) {
  return this.findAll({
    where: {
      isActive: true,
      ...options.where,
    },
    attributes: { exclude: ["password"] },
    order: options.order || [["createdAt", "DESC"]],
    limit: options.limit || 50,
    offset: options.offset || 0,
  });
};

User.countByRole = async function () {
  const result = await this.findAll({
    attributes: ["role", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
    where: { isActive: true },
    group: ["role"],
    raw: true,
  });

  return result.reduce((acc, item) => {
    acc[item.role] = parseInt(item.count);
    return acc;
  }, {});
};

// Scopes
User.addScope("withoutPassword", {
  attributes: { exclude: ["password"] },
});

User.addScope("active", {
  where: { isActive: true },
});

User.addScope("formateurs", {
  where: { role: "formateur", isActive: true },
});

module.exports = User;
