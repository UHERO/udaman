class Xseries < ApplicationRecord
  include Cleaning
  validate :required_fields
  before_destroy :last_rites, prepend: true

  has_many :series, inverse_of: :xseries
  has_one :primary_series, class_name: 'Series'
  has_many :data_points, dependent: :delete_all

  serialize :factors, Hash

  def required_fields
    return true if primary_series.universe != 'UHERO' ## only enforce for UHERO series
    return true if primary_series.scratch == 90909  ## don't enforce if in process of being destroyed
    return true if primary_series.name =~ /test/i   ## don't enforce if name contains "TEST"
    raise('Cannot save a Series without Percent') if percent.blank?
    raise('Cannot save a Series without Seasonal Adjustment') if seasonal_adjustment.blank?
    raise('Cannot save a Series without Units') if units.blank?
    raise('Cannot save a Series without Frequency Transform') if frequency_transform.blank?
    raise('Cannot save a Series without Restricted') if restricted.blank?
    true
  end

private

  def last_rites
    primary_series.reload rescue return
    message = "ERROR: Cannot destroy Xseries (id=#{id}) because its primary series still exists."
    Rails.logger.error { message }
    raise SeriesDestroyException, message
  end

end
