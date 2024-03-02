class User < ApplicationRecord
  include Cleaning
  has_many :loader_actions
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

  def username
    email.sub(/@.*/, '')
  end

  def clipboard
    series
  end

  def add_series(series_to_add)
    if series_to_add.class == Series
      series.push(series_to_add) rescue return(0)
      return 1
    end
    count = 0
    series_to_add.each do |s|
      series.push(s) rescue next  ## rescue in case of duplicate link
      count += 1
    end
    count
  end

  def clear_series(series_to_remove = nil)
    series_to_remove ? series.delete(series_to_remove) : series.delete_all
  end

  def do_clip_action(action)
    return nil if action.blank?

    case action
    when 'reload'
      job = ReloadJob.create!(user_id: id, params: [username, {nightly: true}].to_s) rescue raise('Failed to create ReloadJob object')
      job.series << series
      "Reload job #{job.id} queued"
    when 'reset'
      series.each {|s| s.enabled_loaders.each {|ld| ld.reset(false) } }
      Rails.cache.clear          ## clear file cache on local (prod) Rails
      ResetWorker.perform_async  ## clear file cache on the worker Rails
      Rails.logger.warn { 'Rails file cache CLEARED' }
      'Reset done'
    when 'clear'
      series.each {|s| s.delete_data_points }
      'Data points cleared'
    when 'restrict'
      series.each {|s| s.xseries.update_columns(restricted: true) }   ## update_columns is used to circumvent model validations, which would
      nil
    when 'unrestrict'
      series.each {|s| s.xseries.update_columns(restricted: false) }  ## be troublesome to have enforced for this operation
      nil
    when 'destroy'
      failed = []
      nogo = false
      series.each {|s| s.destroy! rescue failed.push(s) }
      failed.each {|s| s.destroy! rescue nogo = true }  ## second pass
      nogo ? 'Some series could not be destroyed' : nil
    else
      Rails.logger.warn { "User.do_clip_action: unknown action: #{action}" }
      "Unknown action: #{action}"
    end
  end

  def meta_update(properties)
    User.transaction do
      series.each {|s| s.update!(properties) }
    end
  end

end
