class Xseries < ApplicationRecord
  include Cleaning
  validate :required_fields
  before_destroy :last_rites, prepend: true

  has_many :series, inverse_of: :xseries
  has_one :primary_series, class_name: 'Series'
  has_many :data_points, dependent: :delete_all

  serialize :factors, Hash

  def required_fields
    return true if primary_series && primary_series.no_enforce_fields?
    raise(SeriesMissingFieldException, 'Cannot save a Series without Percent') if percent.nil?
    raise(SeriesMissingFieldException, 'Cannot save a Series without Seasonal Adjustment') if seasonal_adjustment.blank?
    raise(SeriesMissingFieldException, 'Cannot save a Series without Units') if units.blank?
    raise(SeriesMissingFieldException, 'Cannot save a Series without Frequency Transform') if frequency_transform.blank?
    raise(SeriesMissingFieldException, 'Cannot save a Series without Restricted') if restricted.nil?
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
