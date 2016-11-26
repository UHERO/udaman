class User < ActiveRecord::Base
  enum role: [:datauser, :internal, :admin, :dev]
  after_initialize :set_default_role, :if => :new_record?

  # Include default devise modules. Others available are:
  # :token_authenticatable, :confirmable, :lockable and :timeoutable
  # devise :database_authenticatable, :registerable,
  #        :recoverable, :rememberable, :trackable, :validatable
  # 
  # # Setup accessible (or protected) attributes for your model
  # attr_accessible :email, :password, :password_confirmation, :remember_me
  # Include default devise modules. Others available are:
  # :token_authenticatable, :encryptable, :confirmable, :lockable, :timeoutable and :omniauthable, :registerable, :recoverable,
  devise :database_authenticatable, :rememberable, :trackable, :validatable, :recoverable

  # Setup accessible (or protected) attributes for your model
  #attr_accessible :email, :password, :password_confirmation, :remember_me

  def set_default_role
    self.role ||= :datauser
  end

  def internal_user?
    self.internal? || self.admin? || self.dev?
  end

  def admin_user?
    self.admin? || self.dev?
  end

  def dev_user?
    self.dev?
  end

#registration email is still not working. maybe email about it later.

#to create users User.create!(:email => "your@email.com", :password => "secret", :password_confirmation => "secret")
#to make customized views
#script/generate devise_views
end