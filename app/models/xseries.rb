class Xseries < ApplicationRecord
  include Cleaning
  before_destroy :last_rites, prepend: true

  has_many :series, inverse_of: :xseries
  has_one :primary_series, class_name: 'Series'
  has_many :data_points, dependent: :delete_all

  serialize :factors, Hash

  def last_rites
    Rails.logger.warn { ">>>>>>>>>>>>>>>>> entering last rites: #{primary_series_id}|" }
    primary_series.reload rescue return
    ### The use of throw(:abort) prevents the object from being destroyed
    Rails.logger.warn { ">>>>>>>>>>>>>>>>> now here" }
    throw(:abort)  ## this line is only reached if primary_series still exists
  end
end
