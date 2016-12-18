class Measurement < ActiveRecord::Base
  has_many :series
  has_many :data_list_measurements
  has_many :data_lists, through: :data_list_measurements

  def prefix_and_name
    "#{prefix} -> #{data_portal_name}"
  end
end
