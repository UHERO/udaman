class User < ApplicationRecord
  include Cleaning
  has_many :data_source_actions
  has_many :user_series, dependent: :delete_all
  has_many :series, -> {distinct}, through: :user_series

  enum role: {
      external: 'external',
      fsonly: 'fsonly',
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

  def dbedt?
    universe == 'DBEDT' && external?
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

  def clipboard_contains?(series)
    self.series.include?(series)
  end

  def add_series(series_to_add)
    series << series_to_add
  end

  def clear_series(series_to_remove = nil)
    series_to_remove ? series.delete(series_to_remove) : series.delete_all
  end
end
