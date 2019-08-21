class Measurement < ApplicationRecord
  include Cleaning
  has_many :data_list_measurements, dependent: :delete_all
  has_many :data_lists, through: :data_list_measurements

  belongs_to :source, optional: true, inverse_of: :measurements
  belongs_to :source_detail, optional: true, inverse_of: :measurements
  belongs_to :unit, optional: true, inverse_of: :measurements

  has_many :measurement_series, dependent: :delete_all
  has_many :series, -> {distinct}, through: :measurement_series
  accepts_nested_attributes_for :series

  enum seasonal_adjustment: { not_applicable: 'not_applicable',
                              seasonally_adjusted: 'seasonally_adjusted',
                              not_seasonally_adjusted: 'not_seasonally_adjusted' }

  def prefix_and_name
    "#{prefix} -> #{data_portal_name}"
  end

end
