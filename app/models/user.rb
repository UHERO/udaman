class User < ActiveRecord::Base
  belongs_to :data_source_actions
  enum role: {
      external: 'external',
      heco: 'heco',
      internal: 'internal',
      admin: 'admin',
      dev: 'dev'
  }

  # Include default devise modules. Others available are:
  # :token_authenticatable, :confirmable, :lockable and :timeoutable
  # devise :database_authenticatable, :registerable,
  #        :recoverable, :rememberable, :trackable, :validatable
  # 
  # # Setup accessible (or protected) attributes for your model
  # attr_accessible :email, :password, :password_confirmation, :remember_me
  # Include default devise modules. Others available are:
  # :token_authenticatable, :encryptable, :confirmable, :lockable, :timeoutable and :omniauthable, :registerable, :recoverable,
  devise :database_authenticatable, :rememberable, :trackable, :validatable, :recoverable, :registerable

  # Setup accessible (or protected) attributes for your model
  #attr_accessible :email, :password, :password_confirmation, :remember_me

  def dbedt?
    universe == 'DBEDT' && external?
  end

  def nta?
    universe == 'NTA' && external?
  end

  def internal_user?
    universe == 'UHERO' && (internal? || admin? || dev?)
  end

  def admin_user?
    universe == 'UHERO' && (admin? || dev?)
  end

  def dev_user?
    universe == 'UHERO' && dev?
  end
end
