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
    if series_to_add.class == Series
      series.push(series_to_add)
      return
    end
    series_to_add.each do |s|
      series.push(s) rescue nil  ## rescue in case of duplicate add
    end
  end

  def clear_series(series_to_remove = nil)
    series_to_remove ? series.delete(series_to_remove) : series.delete_all
  end

  def do_clip_action(action)
    case action
    when 'restrict'
      series.each {|s| s.update!(restricted: true) }  ## AR update_all() method can't be used bec Series overrides its update()
    when 'unrestrict'
      series.each {|s| s.update!(restricted: false) }
    when 'destroy'
      series.each {|s| s.destroy! }
    else
      Rails.logger.warn { "User.do_clip_action: unknown action: #{action}" }
    end
  end
end
