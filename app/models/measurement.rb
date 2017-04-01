class Measurement < ActiveRecord::Base
  has_many :data_list_measurements
  has_many :data_lists, through: :data_list_measurements

  belongs_to :source, inverse_of: :measurements
  belongs_to :source_detail, inverse_of: :measurements

  has_many :measurement_series
  has_many :series, -> {distinct}, through: :measurement_series
  accepts_nested_attributes_for :series

  def prefix_and_name
    "#{prefix} -> #{data_portal_name}"
  end
end
