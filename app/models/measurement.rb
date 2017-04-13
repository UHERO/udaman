class Measurement < ActiveRecord::Base
  enum seasonally_adjusted: { seas_adj: 'Seasonally-adjusted',
                              non_seas_adj: 'Not-seasonally-adjusted',
                              not_applicable: 'not-applicable' }
  has_many :data_list_measurements, dependent: :delete_all
  has_many :data_lists, through: :data_list_measurements

  belongs_to :source, inverse_of: :measurements
  belongs_to :source_detail, inverse_of: :measurements

  has_many :measurement_series, dependent: :delete_all
  has_many :series, -> {distinct}, through: :measurement_series
  accepts_nested_attributes_for :series

  def prefix_and_name
    "#{prefix} -> #{data_portal_name}"
  end
end
