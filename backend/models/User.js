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
        is: /^[a-zA-Z0-9_-]+$/,
      },
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
        notEmpty: true,
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
    role: {
      type: DataTypes.ENUM("etudiant", "formateur", "admin"),
      defaultValue: "etudiant",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    avatar: {
      type: DataTypes.STRING(500),
      allowNull: true,
      validate: {
        isUrl: true,
      },
    },
    preferences: {
      type: DataTypes.JSON,
      defaultValue: {
        theme: "light",
        language: "fr",
        notifications: true,
      },
    },
  },
  {
    tableName: "users",
    indexes: [
      {
        unique: true,
        fields: ["username"],
      },
      {
        unique: true,
        fields: ["email"],
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
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed("password")) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
    },
  }
);

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
    isActive: values.isActive,
    preferences: values.preferences,
    createdAt: values.createdAt,
    lastLogin: values.lastLogin,
  };
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

// Méthodes d'instance
User.prototype.comparePassword = async function (candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    console.error("Erreur lors de la comparaison du mot de passe:", error);
    return false;
  }
};

User.prototype.updateLastLogin = function () {
  return this.update({ lastLogin: new Date() }, { silent: true });
};

User.prototype.getFullName = function () {
  if (this.firstName && this.lastName) {
    return `${this.firstName} ${this.lastName}`;
  }
  if (this.firstName) {
    return this.firstName;
  }
  if (this.lastName) {
    return this.lastName;
  }
  return this.username;
};

// User.prototype.toJSON = function () {
//   const values = Object.assign({}, this.get());
//   delete values.password; // Ne jamais exposer le mot de passe
//   return values;
// };
User.prototype.toJSON = function () {
  const values = Object.assign({}, this.get());

  delete values.password;
  delete values.refreshToken;

  if (Object.prototype.hasOwnProperty.call(values, "isActive")) {
    values.isActive = Boolean(values.isActive);
  } else if (this.isActive !== undefined) {
    values.isActive = Boolean(this.isActive);
  }

  return values;
};


// Méthodes statiques
User.findByEmail = function (email) {
  return this.findOne({
    where: { email: email.toLowerCase(), isActive: true },
  });
};

User.findByUsername = function (username) {
  return this.findOne({
    where: { username, isActive: true },
  });
};

User.findActiveUsers = function (options = {}) {
  return this.findAll({
    where: { isActive: true, ...options.where },
    attributes: { exclude: ["password"] },
    order: options.order || [["createdAt", "DESC"]],
    limit: options.limit || 50,
    offset: options.offset || 0,
  });
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
