class ReloadQueue < ApplicationRecord
  include Cleaning
  belongs_to :user
  has_many :reload_queue_series, dependent: :delete_all
  has_many :series, -> {distinct}, through: :reload_queue_series

end